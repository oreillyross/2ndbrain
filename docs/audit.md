# Phase 0 audit

> **Superseded for data:** Ross chose a blank slate (see `docs/decisions.md`), so the Postgres queries below are not needed. The code audit still applies.

Phase 0 of `KICKOFF.md` asks for audit numbers from the production database. The agent that prepared this file has no access to the Railway Postgres, so the **Data audit** table is empty. Run the queries below with `psql "$DATABASE_URL"` and fill in the results before Phase 1 starts.

## Data audit (run against Railway Postgres)

| Check | Query | Result |
|---|---|---|
| Row counts | see Q1 | _todo_ |
| Users and emails | Q2 | _todo_ |
| `tags` rows (expect 0 → drop) | Q3 | _todo_ |
| Orphan links | Q4 | _todo_ |
| Links whose source note has another owner than the target (should be 0) | Q5 | _todo_ |
| Notes per user, duplicate titles per user | Q6 | _todo_ |
| Longest note (bytes) | Q7 | _todo_ |
| Notes pointing at another user's theme (should be 0) | Q8 | _todo_ |

```sql
-- Q1 row counts
SELECT 'users' t, count(*) FROM users
UNION ALL SELECT 'notes', count(*) FROM notes
UNION ALL SELECT 'links', count(*) FROM links
UNION ALL SELECT 'themes', count(*) FROM themes
UNION ALL SELECT 'tags', count(*) FROM tags
UNION ALL SELECT 'sessions', count(*) FROM sessions
UNION ALL SELECT 'magic_tokens', count(*) FROM magic_tokens;

-- Q2 users (the Access allowlist email must equal one of these exactly)
SELECT u.id, u.email, count(n.id) AS notes
FROM users u LEFT JOIN notes n ON n.user_id = u.id
GROUP BY u.id, u.email ORDER BY notes DESC;

-- Q3 tags
SELECT count(*) FROM tags;

-- Q4 orphan links (source or target note no longer exists)
SELECT
  count(*) FILTER (WHERE f.id IS NULL)                       AS missing_from,
  count(*) FILTER (WHERE l.to_note_id IS NOT NULL AND t.id IS NULL) AS missing_to
FROM links l
LEFT JOIN notes f ON f.id = l.from_note_id
LEFT JOIN notes t ON t.id = l.to_note_id;

-- Q5 cross-owner links
SELECT count(*) FROM links l
JOIN notes f ON f.id = l.from_note_id
JOIN notes t ON t.id = l.to_note_id
WHERE f.user_id <> t.user_id;

-- Q6 notes per user and duplicate (user_id, title) pairs
SELECT user_id, count(*) FROM notes GROUP BY user_id;
SELECT user_id, title, count(*) FROM notes GROUP BY user_id, title HAVING count(*) > 1;

-- Q7 longest note
SELECT id, title, octet_length(coalesce(content, '')) AS bytes
FROM notes ORDER BY bytes DESC LIMIT 5;

-- Q8 notes assigned to another user's theme
SELECT count(*) FROM notes n JOIN themes th ON th.id = n.theme_id
WHERE th.user_id <> n.user_id;
```

If Q5 or Q8 is non-zero, someone used the pre-hotfix holes; look at those rows before migrating.

## Code audit (done)

### Security hotfix applied (this branch)

| Procedure | Before | After |
|---|---|---|
| `notes.update` | public, no owner check, any `themeId` | protected; `WHERE id AND user_id`; theme must be owned; `NOT_FOUND` otherwise |
| `notes.delete` | public, no owner check, orphaned links | protected; owner-scoped; deletes outgoing links and unresolves incoming ones |
| `notes.backlinks` | public, leaked any note's links | protected; only links from the user's own notes |
| `notes.byTheme` | public | protected; filtered by `user_id` |
| `notes.assignTheme` | no owner check on note or theme | both checked |
| `themes.getNotes` | no owner filter | filtered by `user_id` |
| `themes.summarise` | sent any user's notes to OpenAI, overwrote any synopsis | theme must be owned; notes and update owner-scoped |
| `auth.testEmail` | public, sends email on demand | removed (no web caller) |
| `protectedProcedure` | `Error("UNAUTHORIZED")` → 500 | `TRPCError({ code: "UNAUTHORIZED" })` |
| Magic-link logging | token and email HTML logged in `authRouter` and `services/email.ts` | logs removed |

Not fixed in the hotfix (the whole auth surface is deleted in the migration; see `docs/decisions.md`): open registration, no rate limit on `sendMagicLink`, plaintext tokens in `magic_tokens`, `sameSite: none` cookie, global `UNIQUE(title)`.

### Frontend usage of `notes.list` (input for the Phase 4 pagination change)

- `NotesList.tsx` renders every note through `NoteCard`.
- `NoteCard` uses `note.title` for the card text and `note.content` **only** in the hover preview for titles longer than 120 chars. Dropping `content` from the list means the hover preview either goes or fetches via `getById` on hover.
- `NoteCard` calls `notes.backlinks` once per card: N queries for N notes, all batched into one tRPC request. At 10,000 notes this breaks the 50-subrequest Worker cap. Phase 4 must replace it (e.g. return a backlink count with the paginated list, or drop it from the card).
- `NoteCard` renders `b.toTitle` for each backlink, which is the card's own title, not the linking note's. Pre-existing display bug; fix when the card is reworked in Phase 4.
- `CreateNote.tsx` writes optimistic entries into the `notes.list` cache with `setData(undefined, …)`; with an input-keyed paginated query this must change to the infinite-query cache.
- `SingleNote.tsx` and `ThemeInlineSelector.tsx` only invalidate `notes.list`.

### Pre-existing issues found (not fixed, out of Phase 0 scope)

- `web` typecheck fails: `LinkedThoughts.tsx` reads `toNoteId`, `id`, `toTitle` off `links.getLinked` rows, but that procedure returns the joined `{ notes, links }` shape. `server/context.ts` also needs `import type` under `verbatimModuleSyntax`. `server` typecheck passes.
- `drizzle/000X_add_search_vector.sql` and `extra/scripts.sql` are hand-applied and not in the Drizzle journal; the schema declares `search_vector` as `text`.
- `server/lib/extractLinks.ts` is never called (Phase 10).
- `links.create` rejects linking a note to itself (expects 2 rows).

### Hotfix verification

No test harness exists yet (Phase 2 adds vitest). The hotfix was checked with a throwaway script that applies `drizzle/0000–0002` to an in-memory PGlite Postgres and calls `appRouter.createCaller` as two users and as anonymous: 20/20 checks passed (cross-user update/delete/assignTheme/summarise → `NOT_FOUND`, anonymous → `UNAUTHORIZED`, cross-user reads empty, link cleanup on delete, `testEmail` gone). These cases become the Phase 3 isolation suite.
