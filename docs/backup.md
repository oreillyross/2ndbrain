# Backups

Turso's free plan keeps only 1 day of point-in-time recovery. On top of that, a GitHub Action (`.github/workflows/backup.yml`) exports the whole database every night at 03:23 UTC into a **private git repo**, so every day's state is in git history.

The export runs in GitHub Actions, never in the Worker: reading every note would blow the free-plan 10 ms CPU cap.

## Snapshot format

```
manifest.json      {"format": 1}
users.json         sorted by id
themes.json        sorted by id (includes synopses)
links.json         sorted by id (to_note_id null = unresolved [[wikilink]])
notes/<id>.md      one file per note
```

A note file is readable Markdown with frontmatter. Values are JSON (also valid YAML); everything after the closing `---` is the note content, byte for byte:

```markdown
---
id: "6de7f197-0622-4c96-8edf-7a84765e9233"
rid: 1
user_id: "1b053e22-cbbc-44b9-84ef-da8c7248a3f6"
title: "One"
theme_id: null
created_at: "2026-11-06T14:29:32.584Z"
updated_at: "2026-11-06T14:29:32.584Z"
---
hello [[Two]]
```

Files are named by note id, not title, so renaming a note does not rename its file. Deleted notes disappear from the next snapshot (and stay in git history).

## Restore drill (every night)

After exporting, the workflow restores the snapshot into a scratch in-memory SQLite database (migrations applied, FTS index rebuilt by the triggers), exports it again and requires:

- the same row counts per table,
- every note byte for byte, every theme, user and link identical (so backlinks match),
- the FTS5 index passes `integrity-check` and has one entry per note (so search returns what it did).

If any check fails, the job fails and nothing is pushed. `server/backup/backup.test.ts` also checks, on a seeded database, that notes, backlinks, themes, the paginated list and searches return the same results before and after a restore, and that owner isolation holds.

## Setup

1. Create a **private** repo, e.g. `oreillyross/2ndbrain-backup`, initialised with a README (the checkout step needs at least one commit).
2. Create a fine-grained GitHub token limited to that one repo with **Contents: Read and write**.
3. Create a read-only Turso token:

   ```bash
   turso db tokens create 2ndbrain --read-only
   ```

4. In `oreillyross/2ndbrain` → Settings → Secrets and variables → Actions:

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `TURSO_DATABASE_URL` | production URL (already there for deploys) |
   | Secret | `BACKUP_TURSO_AUTH_TOKEN` | the read-only token from step 3 |
   | Secret | `BACKUP_REPO_TOKEN` | the token from step 2 |
   | Variable | `BACKUP_REPO` | `oreillyross/2ndbrain-backup` |

5. Actions → Backup → **Run workflow** once, and check the backup repo got a commit.

Until these exist, the workflow no-ops with a notice. Tokens expire: when the GitHub token does, the nightly run fails and GitHub emails you.

## Running it by hand

```bash
TURSO_DATABASE_URL=libsql://2ndbrain-<org>.turso.io TURSO_AUTH_TOKEN=<read-only> npm run backup -- export ./my-backup
```

```bash
npm run backup -- verify ./my-backup
```

`verify` uses an in-memory database by default. To drill against a real throwaway Turso database instead, set `SCRATCH_DATABASE_URL` and `SCRATCH_AUTH_TOKEN` (the database must be empty).

## Restoring for real

1. Create a fresh database: `turso db create 2ndbrain-restore`, and a full-access token for it.
2. Clone the backup repo and check out the commit you want (`git log` shows one per night).
3. Restore. It applies the migrations itself and refuses a database that already has users:

   ```bash
   TURSO_DATABASE_URL=libsql://2ndbrain-restore-<org>.turso.io TURSO_AUTH_TOKEN=<token> npm run backup -- restore ./2ndbrain-backup
   ```

4. Point the Worker at it (`npx wrangler secret put TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`), and update the `TURSO_*` repository secrets used by the deploy and backup workflows.
5. User ids are preserved, so the next Access login with the same email sees all the notes.

The same files restore into a plain SQLite file (`TURSO_DATABASE_URL=file:restored.db`), which keeps the data portable if Turso's free plan changes.
