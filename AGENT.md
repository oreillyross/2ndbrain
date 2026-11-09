# Project: 2ndBrain

Purpose: a fast, minimal, browser-based note system for thinking clarity, not feature richness.

The migration plan lives in `KICKOFF.md`. Read it before changing anything structural. Decisions not covered there are recorded in `docs/decisions.md`.

explain things in ASD-STE100, a controlled vocabulary originally designed for aircraft maintenance manuals, to strip out unnecessary words.
---

# Philosophy

The tool must stay fast, simple, boring and minimal. If a feature slows thinking or adds UI complexity, it does not belong.

The user should be able to:

1. create a note in < 2 seconds
2. search instantly
3. link ideas effortlessly

---

# Tech Stack

The app is mid-migration (see `KICKOFF.md`). Target stack, which new code must use:

Backend:
- Cloudflare Workers (free plan), Hono, `@hono/trpc-server`
- tRPC 11 + superjson + Zod
- Drizzle ORM, SQLite dialect, on Turso via `@libsql/client/web` (client created per request from `env`)
- SQLite FTS5 for search
- Auth: Cloudflare Access in front of the Worker; the Worker verifies `Cf-Access-Jwt-Assertion` with `jose`. No application login code.

Frontend:
- React 19, TypeScript, Vite, TanStack Query, wouter
- Tailwind
- `react-markdown` + `remark-gfm` (no raw HTML)

Tooling: npm (single package, not a monorepo), wrangler, vitest.

Legacy stack still running in production until cutover (Phase 9): Express, node-postgres, Postgres on Railway, magic-link auth via Resend. Only touch it for security fixes.

No additional frameworks without strong justification.

---

# Workers free-tier rules

- 10 ms CPU and 50 subrequests per invocation; a batched tRPC request counts as one invocation.
- Each procedure does at most 3 DB round trips and states its budget; tests assert it.
- Paginate lists. Never return every note with full content.

---

# Security rules

- Routers never touch `db` or schema tables directly; they go through `ctx.repo` (owner-scoped). Every query is scoped to the current user.
- Every procedure that reads or writes user data is a `protectedProcedure`. Auth failures throw `TRPCError`, not `Error`.
- Never trust an ID from the client without checking it belongs to the user (notes, themes, links).
- Never render raw HTML from notes (no `rehype-raw` without `rehype-sanitize`).
- Never log tokens, secrets or note content.

---

# Feature set

Implemented and kept:

- create, edit, delete notes
- search notes
- wiki-style linking `[[note]]` and backlinks
- markdown rendering of note content
- themes (group notes) and an AI theme synopsis (OpenAI, on demand only)

Not in scope during the migration: new features of any kind. The only deliberate behaviour change is the paginated `notes.list`. Syncing `[[wikilinks]]` into the `links` table on save is Phase 10, after parity.

Still forbidden:

- graph view
- plugins
- collaboration
- mobile apps
- sync engines / offline mode
- folders, nested notebooks
- block editors
- AI features beyond the existing theme synopsis

If a feature is not required for writing and linking notes, it is unnecessary.

---

# UI Constraints

UI must remain minimal: note editor, search bar, backlinks panel, theme list. No complex layout systems.

---

# Engineering Rules

Prefer vertical feature slices, simple database queries, readable code, boring architecture. If something can be solved with simple SQL instead of application logic, use SQL.

Avoid premature abstraction, microservices, event systems, complex caching, unnecessary state managers.

If a feature requires more than ~200 lines of code, question whether it belongs.

---

# Success Criteria

- it can hold 10,000 notes
- search returns in < 100 ms
- linking works reliably
- the UI is frictionless

Before adding any feature ask: "Does this make thinking faster?" If not, do not build it.
