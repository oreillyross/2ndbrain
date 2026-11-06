# 🧠 2ndBrain — Thinking Engine

> A fast, minimal, note system designed for **clarity of thought**.

## ✨ What This Is

2ndBrain is a **high-speed thinking system** that evolves beyond a simple Zettelkasten into a **structured thought engine**.

It allows you to:

* capture ideas instantly
* connect them into meaningful structures (themes)
* generate higher-order understanding (synopsis)

This is not a notes app.
This is **infrastructure for thinking**.

## 🧭 Core Philosophy

Borrowed from Zettelkasten minimalism, extended into intelligence workflows:

* ⚡ **Speed over features**
* 🧠 **Thinking > organizing**
* 🔗 **Connections over hierarchy**
* 📉 **Low friction always wins**
* 🚫 **No unnecessary complexity**

> If it slows you down, it doesn’t belong.

## 🏗️ Current System (Vertical Slices)

### 1. Notes (Atomic Thinking)

* Create instantly
* Editable
* Minimal schema (title + optional content)
* Owned per user (auth system)

---

### 2. Themes (Emergent Structure)

* Group notes into higher-level ideas
* Acts as a **thinking container**
* Aggregates note count
* Foundation for intelligence workflows

---

### 3. Theme Synopsis (AI Layer — Controlled)

* Generates summaries across notes
* Stored, versioned, and refreshable
* Designed to support:

  * synthesis
  * pattern recognition
  * narrative building

---

### 4. Auth

* Cloudflare Access in front of the app; no login code in the app
* All data scoped per user (`userId`)

---

## 🧱 Tech Stack

The app is migrating to a free-tier serverless stack. The plan is in [`KICKOFF.md`](./KICKOFF.md); decisions are in [`docs/decisions.md`](./docs/decisions.md).

| | Old app (`pg-final` tag) | Now |
|---|---|---|
| Runtime | Node.js + Express on Railway | Cloudflare Workers + Hono |
| API | tRPC 11 + superjson + Zod | same, via `@hono/trpc-server` |
| DB | PostgreSQL (Drizzle, node-postgres) | Turso / libSQL (Drizzle, SQLite dialect) |
| Search | Postgres `tsvector` | SQLite FTS5 |
| Auth | Magic links (Resend) | Cloudflare Access |
| Frontend | React 19, Vite, TanStack Query, wouter, Tailwind, react-markdown | same |

---

## 🗂️ Architecture

```
/web      → React frontend
/server   → Hono app + tRPC (worker.ts is the Cloudflare Worker entry)
/shared   → shared types (`AppRouter`)
/migrations → SQLite migrations (incl. hand-written FTS5)
/docs     → audit and decision records
```

Single deployment unit.
No microservices.
No unnecessary abstraction.

---

## ⚙️ Scripts

```bash
npm run dev          # Vite (:3000, proxies /api,/trpc) + wrangler dev Worker on :8787
npm run preview      # production build served by wrangler dev on :8787 (assets + API)
npm test             # vitest: repo, isolation, round-trip budgets, tRPC, Access, XSS
npm run typecheck    # server + web
npm run deploy       # build + wrangler deploy (Cloudflare)
npm run db:generate  # drizzle-kit generate (never `push`: FTS5 is hand-written)
npm run db:migrate   # apply migrations to TURSO_DATABASE_URL
```

## ☁️ Deployment

One Cloudflare Worker: the React build is served as static assets (SPA fallback, `_headers` CSP), `/api/*` and `/trpc/*` run Hono + tRPC at the edge, data lives in Turso. Cloudflare Access handles login. Step-by-step: [`docs/deploy.md`](./docs/deploy.md). Pushes to `main` auto-deploy once the GitHub secrets are set.

Backups: a nightly GitHub Action exports every note as Markdown into a private git repo and runs a restore drill. Setup and restore steps: [`docs/backup.md`](./docs/backup.md).

---

## 🧠 Data Model (Simplified)

### Notes

* id
* title
* content (markdown)
* userId
* themeId (nullable)
* createdAt
* updatedAt

### Links

* fromNoteId → toNoteId (nullable when unresolved), toTitle

### Themes

* id
* name
* description
* synopsis
* synopsisUpdatedAt
* synopsisModel
* createdAt

---

## 🚀 Design Decisions

### 1. Monolith First

intentionally:

* avoiding microservices
* avoiding premature scaling
* optimizing for iteration speed

---

### 2. Vertical Slice Development

Each feature is:

* end-to-end
* usable immediately
* independently valuable

---

### 3. SQL > Abstraction

* Prefer simple joins over complex logic
* Let the database do the heavy lifting

---

### 4. AI as a Layer (Not Core)

Unlike typical apps:

* AI is **additive**, not foundational
* The system must work without it
* AI enhances thinking, not replaces it

---

## ❌ What We Avoid

From the original philosophy:

* graph views
* plugin systems
* over-designed UI
* collaboration features
* mobile apps (for now)
* complex editors
* unnecessary state management

---

## 🎯 Current Status

✅ Notes CRUD working
✅ Themes system implemented
✅ Theme-note linking
✅ Synopsis pipeline scaffolded
✅ Owner checks on every note/theme procedure (security hotfix)
✅ Runs on Cloudflare Workers (static assets + edge API) + Turso, behind Cloudflare Access

---

## 🧪 Development Principles

Before building anything, ask:

> **“Does this make thinking faster?”**

If not:

* don’t build it
* or delay it

---

## 🧠 Builder Mindset

This project follows:

* rapid iteration loops
* learning through shipping
* refinement through real usage

Inspired by:

* Hormozi-style execution
* Tim Denning-style obsession
* my own **Faktor_10 philosophy**

---

## ⚡ Final Note

This is not a productivity app.

It is a **thinking weapon**.

Build it fast.
Keep it simple.
Let it evolve.


