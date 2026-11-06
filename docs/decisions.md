# Decisions

Decisions for the migration in `KICKOFF.md`. Section 5 open items are resolved here with the plan's defaults; Ross can overturn any of them by editing this file.

| # | Decision | Status | Notes |
|---|---|---|---|
| 1 | Themes, AI synopsis and markdown rendering stay | Decided (default) | `AGENT.md` updated to match the code |
| 2 | Drop `tags` from the ported schema | Decided | No data is migrated (see below) |
| 3 | Hostname: `workers.dev` with one-click Access | Decided (default) | `preview_urls = false` |
| 4 | `themes.summarise` stays on OpenAI `gpt-4.1-mini` | Decided (default) | Swapping provider is a later change |
| 5 | Turso vendor news | **Ross to read before Phase 7** | D1 is the fallback; data stays portable SQLite |

## Phase 0 choices made by the agent

- **Hotfix scope.** Fixed the owner checks listed in KICKOFF 2.1 plus removed magic-link token logging. Did not add rate limiting, token hashing or registration restrictions: that code is deleted in the migration, and the hotfix should stay small. If cutover slips by weeks, revisit.
- **`notes.delete` and links.** There is no FK on `links`, so the hotfix deletes the note's outgoing links and sets `to_note_id = null` on incoming ones (the link becomes unresolved, keeping `to_title`). This matches the target FK behaviour (`cascade` / `set null`).
- **`notes.backlinks` scoping.** Scoped through the source note's owner (join on `from_note_id`), the same rule `links.getBacklinks` already uses.
- **Not-found vs forbidden.** Accessing another user's note or theme returns `NOT_FOUND`, never `FORBIDDEN`, so IDs can't be probed.
- **Hotfix branch.** KICKOFF says "hotfix PR on `main`". It ships on the session's working branch as one PR into `main`, together with the doc changes, since neither touches migration code.
- **`pg-final` tag and `cf-turso` branch.** Created by Ross after the hotfix PR is merged and deployed, so the tag points at the patched code.

## Blank slate (2026-11-05, Ross)

No data moves from Railway Postgres. The new app starts with an empty Turso database.

- **Phase 7 (data migration) is dropped.** UUID preservation, `links.user_id` backfill and orphan cleanup no longer matter.
- **`docs/audit.md` data queries are not needed.** The code-audit part still feeds Phase 4.
- **Identity mapping gotcha (KICKOFF 6.1) is gone:** the first Access login creates the user.
- **Schema can be designed fresh for SQLite + FTS5** in Phase 2 (still following KICKOFF section 7, minus anything that existed only to preserve old data).
- `pg-final` tag stays as the rollback point for the old app.

## Phase 1 choices

- **Worker code lives in `server/edge/`** with `server/worker.ts` as the entry, checked by its own `tsconfig.worker.json` (workers types, bundler resolution). The root `tsconfig.json` excludes it so the legacy Express build is unaffected until it is deleted.
- **Express scripts are kept** (`dev`, `build:api`, `start*`) until the routers move to the Worker in Phase 4; new scripts are `dev:worker`, `deploy`, `test`, `typecheck`.
- **`@hono/trpc-server` is not added yet**; it arrives with the first ported router. `/trpc/*` is already behind Access and returns 404.
- **Dev bypass also requires a localhost hostname**, on top of `ENVIRONMENT=development` and `DEV_EMAIL`, so a misconfigured deploy still can't use it.
- **`ALLOWED_EMAILS` empty = fail closed (500)**, same as missing `TEAM_DOMAIN`/`POLICY_AUD`.
- **JWT checks:** RS256 only; `iss` must equal `TEAM_DOMAIN` (trailing slash stripped); `aud` must equal `POLICY_AUD`; `exp` enforced by jose. Email compared lowercased.
- **Health DB failure returns 503 `{db:"error"}`** with the error logged, never echoed.
- **`compatibility_date` 2026-10-01.**

## Phase 2 choices

- **New schema lives in `server/edge/db/schema.ts`**, separate from the legacy Postgres schema in `server/db/`, which is deleted with Express in Phase 4.
- **Migrations in `migrations/`** (drizzle-kit `dialect: "turso"`). Old Postgres migrations and `extra/scripts.sql` moved to `archive/drizzle-pg/`.
- **IDs:** `text` UUIDs from `crypto.randomUUID()` (the web app routes on them); `notes.rid` integer is the FTS rowid only.
- **Timestamps:** `integer` `timestamp_ms`, SQL default `unixepoch('subsec') * 1000`; `notes.updated_at` also set by Drizzle `$onUpdateFn`.
- **`themes.synopsis_updated_at`** is set explicitly when a synopsis is generated, instead of the old `$onUpdate` that bumped it on any theme edit.
- **`links.user_id`** added (owner scoping without a join), cascade-deleted with the user.
- **FTS5** external-content table on `rid`, porter + unicode61 + remove_diacritics 2; update trigger only fires on `title`/`content` changes.
- **Foreign keys:** libSQL has `foreign_keys` on by default locally (tested). Turso Cloud over HTTP is **unverified**, so repo code (Phase 3) deletes/unlinks links itself in the same batch as a note delete rather than relying on cascades.
- **CI:** GitHub Actions on PRs and pushes to `main`/`cf-turso`: `typecheck`, `test`, `build:web`. Web typecheck is not in CI yet (pre-existing errors; fixed in Phase 6).

## Phase 3–5 choices

- **Layout:** the legacy Express server is deleted and `server/edge/*` is flattened into `server/` (`app.ts`, `access.ts`, `db/`, `trpc/`). One `tsconfig.json` (Workers types, bundler resolution) covers `server/` and `shared/`.
- **Repo returns `TRPCError`s** (NOT_FOUND, CONFLICT, BAD_REQUEST) directly. Coupling to tRPC is accepted to keep routers one-liners.
- **Ownership checks inside the write statement** (`UPDATE … WHERE id AND user_id AND (theme is null OR theme owned)`), so update/assignTheme are 1 round trip; failure is NOT_FOUND either way.
- **`notes.list`** is keyset-paginated on `(updated_at desc, rid desc)` with an opaque cursor, default 50, max 100, no `content`.
- **Search:** user text is tokenised and each token quoted for FTS5 (operators become literals); last token gets a `*` prefix match for search-as-you-type; ranking `bm25(notes_fts, 10, 1)` weights title over content; 20 results.
- **Self-links allowed** (old code rejected them by accident).
- **User lookup** per request is cached per isolate (email → id), so a warm request costs 0 extra round trips.
- **Batch cap:** the server rejects tRPC batches over 10 procedures (413); the client sets `maxItems: 10`. tRPC 11 has no server-side option for this.
- **CSRF:** non-GET `/trpc` requests must send `Origin` equal to the request origin. No CORS headers are emitted.
- **AI:** `themes.summarise` goes through a `Summariser` in context (OpenAI Responses API via `fetch`, `OPENAI_API_KEY` secret). Upstream errors become `BAD_GATEWAY` without details. Budget: 2 DB round trips + 1 subrequest.
- **`auth.logout` removed**; logout is the Access URL `/cdn-cgi/access/logout` (Phase 6).
- **Phase 5 (search)** landed inside Phase 3/4: there is no separate commit.

## Phase 6 + Railway MVP choices

- **Frontend:** removed the login/callback pages and the logout mutation; `App` shows "Not authorised." when `auth.me` is null; Logout links to `/cdn-cgi/access/logout`. `httpBatchLink` has `maxItems: 10`. `NoteConnections` uses the flat `links.getLinked` shape. `CreateNote` dropped the optimistic `notes.list` update (it navigates away anyway).
- **Dead code removed** (none of it was routed or imported): `NotesList`, `NoteCard`, `LinkedThoughts`, `SearchScreen`, `ThemeListPage`, `renderNoteContent`, `linkHandler`, `useHandleLinkClick`. `ThemeSummary` (the Summarise button) is kept but is still **not mounted anywhere**, as before: ask Ross.
- **Markdown** moved into `NoteMarkdown` with an XSS regression test (`<script>`, `onerror=`, `javascript:` links/images).
- **CSP** in `web/public/_headers` (copied to `dist/`), served by Workers assets and by the Node server.
- **Web typecheck now passes** and is part of `npm run typecheck` / CI.
- **Railway MVP via a Node entrypoint**, not `wrangler dev`: same `createApp`, identity middleware swapped to HTTP Basic auth (the Access middleware stays the Worker default, so the Worker cannot fall back to basic auth). SQLite file on a volume by default; migrations run at boot. `tsx` moved to dependencies to run TypeScript in production.
- **CSRF check compares Origin host to request host** (not full origin) because Railway terminates TLS and the app sees `http://`.
- **`/healthz`** is the only unauthenticated route on the Node server.

## Cloudflare-only MVP (2026-11-06, Ross)

The Railway MVP was a mistake in the request: the MVP is hosted on Cloudflare.

- **Removed the Node/Railway path:** `server/node.ts`, `server/basicAuth.ts`, `Dockerfile`, `.dockerignore`, `railway.json`, `docs/railway.md`, `@hono/node-server`, `tsx`, `start`/`dev:node` scripts. The Phase 6 Railway notes above are superseded.
- **One Worker** serves the static React build (Workers assets, SPA fallback, `_headers`) and the edge API (`run_worker_first` for `/api/*`, `/trpc/*`). No separate Pages project.
- **Turso** stays the database, reached over HTTPS with `@libsql/client/web`. Migrations are applied out-of-band with `npm run db:migrate` (drizzle-kit, FTS5 included), locally or in the deploy workflow, never at Worker startup.
- **Auth** is Cloudflare Access only.
- **Deploy workflow** (`.github/workflows/deploy.yml`) on pushes to `main`: typecheck, test, migrate, deploy. It no-ops with a notice until the Cloudflare and Turso secrets exist.
- `npm run preview` added: production build served by `wrangler dev`.
