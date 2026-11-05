# Decisions

Decisions for the migration in `KICKOFF.md`. Section 5 open items are resolved here with the plan's defaults; Ross can overturn any of them by editing this file.

| # | Decision | Status | Notes |
|---|---|---|---|
| 1 | Themes, AI synopsis and markdown rendering stay | Decided (default) | `AGENT.md` updated to match the code |
| 2 | Drop `tags` from the ported schema | Pending audit Q3 | Confirm 0 rows in `docs/audit.md` |
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
