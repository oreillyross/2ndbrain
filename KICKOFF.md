# 2ndbrain → Hono + Turso + Cloudflare: Migration Plan v2 (SDD seed)

Status: v2, written against the actual repo (`oreillyross/2ndbrain`, commit `1ee0a69` "add strapline", shallow clone read on 2026-11-05). Items marked **(verify)** are things I could not confirm from the repo or docs and that the implementing agent must check.

## 1. What the repo is today

Single package (npm, `package-lock.json`), not a monorepo. About 750 lines of server code and 1,500 of web code.

```
server/        Express 5 + tRPC 11 (superjson) + Drizzle (node-postgres)
  index.ts       express, /trpc, static fallback, PORT for Railway
  context.ts     reads `session` cookie → sessions → users
  trpc.ts        publicProcedure / protectedProcedure
  router.ts      health, notes, links, auth, themes
  db/schema/     notes, links, tags, users, magicLinks, sessions, themes
  db/router/     notes.ts, links.ts, themes.ts, authRouter.ts
  services/email.ts   Resend (magic links)
  lib/extractLinks.ts defined, never called
web/           Vite + React 19, wouter, TanStack Query, react-markdown + remark-gfm
shared/        re-exports types, `AppRouter` for the client
drizzle/       3 generated PG migrations + hand-written 000X_add_search_vector.sql (not in the journal)
extra/scripts.sql   hand-applied tsvector DDL
.replit        stale
```

Auth: custom magic-link login (Resend), `sessions` table, `session` cookie (`sameSite: none`). Search: generated `tsvector` column added by hand SQL (the Drizzle schema declares it as plain `text`), queried with `plainto_tsquery('english')` + `ts_rank`. Themes: group notes, plus an OpenAI `gpt-4.1-mini` "synopsis" call. Markdown: `react-markdown` in `SingleNote`. Links: created manually in the UI via `links.create`; `[[wikilink]]` text is **not** parsed into links on save (`extractLinks` is unused).

## 2. Audit findings that shape the plan

### 2.1 Security problems in the live app (fix on `main` first, independent of the migration)

The app is deployed publicly (Railway) with open sign-up, so these are exploitable today:

| Where | Problem |
|---|---|
| `notes.update` | `publicProcedure`; updates `WHERE id = ?` with no auth and no owner check. Anyone who knows or guesses a note ID can rewrite it |
| `notes.delete` | `publicProcedure`; deletes by ID only, no owner check. Also leaves orphan `links` rows |
| `notes.backlinks`, `notes.byTheme` | `publicProcedure`; no owner check; leak link and note data |
| `notes.assignTheme` | Logged in but no ownership check on the note or the theme |
| `themes.getNotes` | Logged in but no owner filter: any user can read any theme's notes by ID |
| `themes.summarise` | No owner check: sends another user's notes to OpenAI and overwrites their synopsis |
| `auth.testEmail` | Public; sends email on demand |
| `auth.sendMagicLink` | Open registration for any email; no rate limit; tokens stored in plaintext and logged to the console |
| `protectedProcedure` | Throws a plain `Error("UNAUTHORIZED")` (a 500), not a `TRPCError` |
| `notes.title` | `UNIQUE` across all users, so one user's title blocks another's |

The migration removes the auth surface entirely, but **do not port the missing owner checks**. Phase 0 includes a small hotfix PR on the current app so it is safe while the migration is in progress.

### 2.2 Scope-shrinking findings
- `authRouter`, `magicTokens`, `sessions`, `services/email.ts` (Resend), `Login.tsx`, `auth/callback.tsx` all go away. Cloudflare Access replaces them. `auth.me` stays so `App.tsx` gating keeps working.
- All routers already use `ctx.db`/`db` through Drizzle, so the tRPC router layer ports with small changes. `@hono/trpc-server` keeps the frontend's `createTRPCReact<AppRouter>` and `superjson` unchanged.
- No monorepo restructure is needed. Keep `server/`, `web/`, `shared/`.

### 2.3 Things that conflict with the target
- **`AGENT.md` forbids the target stack** ("Backend: Node, Express, Postgres… strict") and also forbids themes, markdown rendering and AI, all of which the repo already has. An implementing agent will treat it as binding. Update `AGENT.md` and `README.md` **first** (Phase 0).
- **`notes.list` returns every note with full content.** At the project's own goal of 10,000 notes, serialising that on the free Worker (10 ms CPU, 128 MB) will fail. This is the one deliberate non-parity change: paginate and omit `content` from list results (Phase 4). Check how `NotesList`/`NoteCard` use the list in Phase 0.
- **tRPC batching vs the 50-subrequest cap:** `httpBatchLink` merges several procedures into one HTTP request, which is one Worker invocation, so the 50-subrequest and 10 ms CPU limits apply to the whole batch. Cap it with `maxItems` (**verify** the v11 option name) and keep each procedure to at most 3 DB round trips.
- The server is CJS (`__dirname`, extensionless imports, `module: NodeNext`). Wrangler bundles with esbuild, so that is fine for the Worker, but add a separate tsconfig for Worker types (`@cloudflare/workers-types`, `moduleResolution: bundler`).
- No tests, no CI, and ESLint only covers `web/`. Phase 2 adds vitest and a minimal CI job (typecheck + tests).

## 3. Goal and target architecture

Same app, same behaviour, running on free-tier infrastructure with no custom auth.

```
Browser ──► Cloudflare Access (email allowlist, one-time PIN or Google)
              │ adds Cf-Access-Jwt-Assertion
              ▼
        Worker (Hono + @hono/trpc-server)
          ├─ /trpc/*  → verify JWT → user (upsert by email) → ctx.repo (owner-scoped) → Turso (HTTPS)
          └─ /*       → static assets (`dist/`, SPA fallback)
```

Non-goals: new features, multi-user hardening beyond owner scoping, a monorepo, replacing the AI synopsis, auto-syncing `[[wikilinks]]` into links (see Phase 10).

## 4. Hard constraints (Workers Free + Turso Free)

| Constraint | Limit | Consequence |
|---|---|---|
| Worker requests | 100,000/day; static assets free and unlimited | Irrelevant for one user |
| CPU | 10 ms per invocation (network waits not counted) | No heavy work in the Worker; measure batched requests |
| Subrequests | 50 per invocation; every Turso call and the OpenAI call is one | At most 3 DB round trips per procedure; `db.batch()` for writes |
| Memory | 128 MB | Paginate lists |
| Turso Free | 5 GB, 500M rows read/mo, 10M rows written/mo, 1-day PITR | Index lookups; own backups |

Rule: each procedure's spec states its DB round-trip count, and a test asserts it with a counting wrapper around the libSQL client.

## 5. Decisions

Made:
- Hono on Workers; `@hono/trpc-server` keeps the existing tRPC routers and superjson.
- Turso via `@libsql/client/web` (the exact import is required on Workers; no `file:` URLs); client created **per request** from `env`.
- Drizzle SQLite dialect (`drizzle-kit` `dialect: "turso"`); `drizzle-orm ^0.45` and `drizzle-kit ^0.31` already support it.
- Cloudflare Access for login. No application auth code.
- FTS5 confirmed working on Turso Cloud by Ross; keep a CI smoke test.

Open (resolve in Phase 0):
1. Do themes, the AI synopsis and markdown stay? (The code says yes; `AGENT.md` says no. Default: they stay, and `AGENT.md` is corrected.)
2. `tags` table: no router or web code uses it. Default: confirm 0 rows, drop it from the ported schema.
3. Hostname: `workers.dev` + one-click Access vs a custom domain. Default: `workers.dev`.
4. LLM provider for `themes.summarise` stays OpenAI for parity; swapping is a later change.
5. Vendor watch: Turso's site shows a banner about joining Supabase. Read it before Phase 7. Data stays portable SQLite; D1 is the fallback.

## 6. Security design

### 6.1 Authentication
- Access application on the Worker; policy Allow with an explicit email list (dashboard, not code). With one-time PIN, non-allowlisted emails never receive a PIN.
- Preview URLs are a separate entrypoint and public unless protected. Set `preview_urls = false` unless used; if `workers_dev` stays on, enable Access on it.
- The Worker **must still verify** `Cf-Access-Jwt-Assertion` (Cloudflare recommends it): `jose` + `createRemoteJWKSet(TEAM_DOMAIN + /cdn-cgi/access/certs)`, check `aud === POLICY_AUD`, `iss`, `exp`. Read the header, not the cookie. Cache the JWKS at module scope. **Fail closed** if `TEAM_DOMAIN` or `POLICY_AUD` is unset. Never trust `Cf-Access-Authenticated-User-Email` alone.
- Defence in depth: also check the verified email against an `ALLOWED_EMAILS` var.
- Local dev bypass only when `ENVIRONMENT=development` and `DEV_EMAIL` is set; the production wrangler config contains neither. A test proves production rejects a missing JWT.
- **Identity mapping gotcha:** the Worker upserts `users` by verified email. The existing app's data hangs off `users.id` (UUIDs). Phase 7 migrates the `users` table with its UUIDs, and the Access email must equal the email already in `users`. Otherwise the first login creates a new empty user and all notes appear to have vanished. Acceptance test: log in through Access and see the migrated note count.

### 6.2 Authorization
- `createContext` exposes `ctx.repo = forUser(db, user.id)` and **no raw `db`**. Every repository method bakes in `user_id = ?`, including links (add `user_id` to `links`, backfilled from the from-note) and theme/note assignment (both the note and the theme must belong to the user).
- Architecture test (vitest, no new lint tooling): router files must not import the schema tables or `db` directly; they use only `ctx.repo`.
- Isolation suite: two users; every repo method called as user B against user A's IDs must return not-found or empty. A registry test fails CI if a repo method is missing from the suite.
- `protectedProcedure` throws `TRPCError({ code: "UNAUTHORIZED" })`.

### 6.3 Browser side
- CSRF: require `Origin` to match for non-GET requests; tRPC mutations are JSON POST. No CORS headers (same-origin).
- XSS: `react-markdown` does not render raw HTML and sanitises URLs by default. Keep it that way; never add `rehype-raw` without `rehype-sanitize`. Add a regression test with `<script>`, `onerror=` and `javascript:` in a note body. Ship a CSP via a static `_headers` file (**verify** Workers Static Assets support for `_headers`).
- Secrets via `wrangler secret`: Turso URL and token, `OPENAI_API_KEY`. A separate read-only Turso token for the backup job if the CLI supports it (**verify**). Remove `RESEND_API_KEY`.

## 7. Data model port (per table)

| Table | Port |
|---|---|
| `users` | `id text` (preserve UUIDs), `email text unique` |
| `magic_tokens`, `sessions` | **Dropped** (not migrated) |
| `notes` | Add `rid integer primary key autoincrement` (FTS rowid) and keep `id text unique not null` (preserved UUIDs). `title`, `content default ''`, `user_id` (FK → `users`), `theme_id` (FK → `themes`, `on delete set null`), `created_at`/`updated_at` as `integer` `timestamp_ms`. Replace global `UNIQUE(title)` with `UNIQUE(user_id, title)`. Drop `search_vector`. Indexes: `(user_id, updated_at)`, `(theme_id)` |
| `links` | `id`, `from_note_id` (FK → `notes.id`, `on delete cascade`), `to_note_id` nullable (FK, `on delete set null`), `to_title`, new `user_id`. Indexes `(user_id, from_note_id)`, `(user_id, to_note_id)`. Phase 0 counts orphan rows that must be cleaned before import |
| `themes` | Same columns; `synopsis_updated_at`/`created_at` as `timestamp_ms`; keep the `$onUpdate` behaviour; `user_id` FK |
| `tags` | Dropped (unused), pending Phase 0 confirmation |

Type notes: superjson continues to round-trip `Date` because Drizzle returns `Date` for `timestamp_ms`. `crypto.randomUUID()` is available on Workers; the `crypto.randomBytes` import goes away with auth. Foreign keys on Turso: Phase 2 tests that a violating insert fails; if not enforced, enforce in repo code.

## 8. Search (FTS5), parity with `plainto_tsquery('english')`

- No `drizzle-kit push` (it can break virtual tables), and `tablesFilter` applies to `push`/`pull`, not `generate`. Use `generate` + `migrate` and write the FTS migration by hand with `drizzle-kit generate --custom`.
- External-content table keyed on the integer `rid`: `CREATE VIRTUAL TABLE notes_fts USING fts5(title, content, content='notes', content_rowid='rid', tokenize='porter unicode61 remove_diacritics 2')` plus the standard AFTER INSERT/UPDATE/DELETE triggers on `notes`. Porter stemming matches the old English config; if the notes contain French or Dutch, note that stemming differs (decision, not a blocker).
- Deleting FTS rows must go by `rowid`; deleting by an UNINDEXED column scans every FTS row on every save.
- Query: `SELECT n.* FROM notes_fts JOIN notes n ON n.rid = notes_fts.rowid WHERE notes_fts MATCH ? AND n.user_id = ? ORDER BY bm25(notes_fts) LIMIT 20`. The join enforces owner scoping. Escape the user's query for FTS5 syntax (quote tokens) so punctuation can't throw.
- CI smoke test creates the FTS table, inserts, matches, and checks owner isolation. Test the `trigram` tokenizer separately if title autocomplete is ever added.

## 9. tRPC on Hono

- Replace `server/index.ts` (Express, `__dirname`, static fallback) with `server/worker.ts`: `new Hono<{ Bindings: Env }>()`, `app.use("/trpc/*", trpcServer({ router: appRouter, createContext }))`, Access middleware before it, and static assets via the `ASSETS` binding.
- `wrangler.jsonc`: `main: server/worker.ts`, `assets.directory: ./dist`, `not_found_handling: "single-page-application"`, `run_worker_first: ["/trpc/*"]` (**verify** the pattern-array syntax), `workers_dev` / `preview_urls` as in 6.1, `compatibility_date`.
- `createContext(opts, c)`: verify JWT → upsert user by email → build the per-request libSQL client from `c.env` → `{ user, repo }`. The old `import { db } from "../"` global in `themes.ts` and `authRouter.ts` disappears.
- Build: keep `vite build` (output `dist/`); drop `build:api` (`tsc`) and `start*` scripts; add `dev:api = wrangler dev`, `deploy = wrangler deploy`. Point the Vite proxy at the wrangler dev port instead of 8080.
- Local DB: a second Turso database (`2ndbrain-dev`, free plan allows 100) used by `wrangler dev`; vitest uses `@libsql/client` (Node build) with a local file for repo and isolation tests.
- Remove dependencies: `express`, `pg`, `@types/express`, `@types/pg`, `resend`. Add: `hono`, `@hono/trpc-server`, `@libsql/client`, `jose`, `wrangler`, `@cloudflare/workers-types`, `vitest`.

## 10. Phases (smallest shippable slices)

**Phase 0: Prep and hotfix (no migration code)**
- Hotfix PR on current `main`: make `notes.update`, `notes.delete`, `notes.backlinks`, `notes.byTheme` protected and owner-scoped; add owner checks to `assignTheme`, `themes.getNotes`, `themes.summarise`; remove `auth.testEmail`; throw `TRPCError`.
- Update `AGENT.md` and `README.md` to the target stack and the actual feature set; delete `.replit`.
- Audit queries against the Railway Postgres: row counts per table, orphan links, `tags` rows, which email(s) are in `users`, longest note.
- Resolve the open decisions in section 5. Tag `pg-final`. Branch `cf-turso`.
- Done when: hotfix deployed; `AGENT.md` matches the target; audit numbers recorded in `docs/audit.md`.

**Phase 1: Walking skeleton**
- `wrangler.jsonc`, `server/worker.ts`, Access (one-click on `workers.dev`), JWT middleware, `GET /api/health` doing `select 1` on Turso, deploy.
- Done when: unauthenticated and wrong-email requests are rejected on every reachable hostname, including preview URLs; allowed email gets `{ email, db: "ok" }`; missing env fails closed; CPU time is well under 10 ms in Workers metrics.

**Phase 2: DB layer and test harness**
- Port the schema files to `sqlite-core` per section 7; `drizzle.config.ts` → `dialect: "turso"`; archive the PG migrations; hand-write the FTS5 migration; vitest + CI (typecheck + tests).
- Done when: migrations apply to an empty Turso DB; FTS5 smoke test and FK test pass in CI.

**Phase 3: Repository, context, isolation tests**
- `server/db/repo.ts` (`forUser`), new `createContext`, `protectedProcedure` with `TRPCError`, architecture test, isolation suite with the registry test.
- Done when: CI fails if a repo method has no isolation coverage or a router imports tables directly.

**Phase 4: Port routers** (one PR per router, each with round-trip count tests)
- `notes`: `list` (paginated, no `content`; **deliberate change**, update `NotesList`/`NoteCard` accordingly), `create`, `update`, `delete` (links handled by FK), `getById`, `getByTitle`, `backlinks`, `byTheme`, `assignTheme`.
- `links`: `create`, `delete`, `getLinked`, `getBacklinks`.
- `themes`: `create`, `list` (note-count join), `getById`, `getNotes`, `summarise` (OpenAI call is one subrequest; key from `env`).
- `auth`: only `me`. `health.ping` stays.
- Done when: every procedure is owner-scoped, within its round-trip budget, and isolation tests pass.

**Phase 5: Search**
- `notes.search` on FTS5 per section 8.
- Done when: results match fixtures; isolation holds; query punctuation cannot error.

**Phase 6: Frontend**
- Remove `Login.tsx`, `auth/callback.tsx`, the logout mutation (use the Access logout URL), and the unauthenticated branch of `App.tsx` (show a plain "not authorised" if `auth.me` is null). Set `maxItems` on `httpBatchLink`. Update the Vite proxy. Add the XSS regression test and CSP file.
- Done when: the deployed app works end to end behind Access, with no CORS headers emitted.

**Phase 7: Data migration (Postgres → Turso)** — **dropped: blank slate, see `docs/decisions.md`**
- One-off Node script (not a Worker, so the subrequest cap does not apply): read PG with the old schema (do not select `search_vector`), transform per section 7 (UUIDs preserved, timestamps to ms, `links.user_id` backfilled, orphan links dropped), write to Turso in chunked batches. Idempotent. Dry run on a scratch Turso DB first. Migrate `users`, `themes`, `notes`, `links`; skip `sessions`, `magic_tokens`, `tags`.
- Done when: per-table counts match; sampled notes match byte for byte; backlink queries and 10 sampled searches match the old results; logging in through Access shows the migrated notes.

**Phase 8: Backups** — **done, see `docs/backup.md`**
- Nightly GitHub Action (not a Worker; the free CPU cap makes an in-Worker export risky) dumps notes as `.md` with frontmatter into a private git repo. Turso's 1-day PITR is not enough on its own.
- Done when: a restore drill rebuilds a scratch DB from the export and Phase 7 verification passes against it.

**Phase 9: Cutover and decommission**
- Freeze writes on the old app, run the migration once more, switch bookmarks/DNS. Keep Railway Postgres for at least 2 weeks. Rollback is `pg-final` plus the untouched database.

**Phase 10 (after parity, optional): sync `[[wikilinks]]` into `links` on save**
- `extractLinks` already exists. On save: resolve titles by `(user_id, title)`, then one `db.batch()` to delete old links and insert new ones (unresolved titles stored with `to_note_id` null). Not part of the migration; it is a new feature.

## 11. Verification (every phase)
- Typecheck, vitest (repo, isolation, architecture, round-trip budget), and for deployed phases: Access rejection on every hostname and fail-closed JWT behaviour.

## 12. Risks
- Free-tier terms can change (Turso vendor news, Workers limits). Mitigation: portable SQLite, nightly export, D1 fallback.
- 10 ms CPU cap on batched tRPC requests. Mitigation: `maxItems`, paginated list, measure in Phase 1 and Phase 4.
- Access/identity mismatch makes data look missing. Mitigation: explicit acceptance test in Phase 7.
- Drizzle + FTS5 friction. Mitigation: hand-written migration, never `push`.

## 13. Instructions for the implementing agent
- Do Phase 0 first; `AGENT.md` currently forbids this stack.
- One phase at a time; do not start a phase until the previous phase's acceptance criteria pass.
- No new features; the only deliberate behaviour change is the paginated `notes.list`.
- Anything not covered here: choose the simplest option and record it in `docs/decisions.md`.
