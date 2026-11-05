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
