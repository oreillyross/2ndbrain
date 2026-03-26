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

### 4. Auth (Production Ready)

* Magic link login
* Secure cookie sessions
* Multi-user isolation (userId scoping)

---

## 🧱 Tech Stack

### Backend

* Node.js
* Express
* tRPC
* Zod
* Drizzle ORM
* PostgreSQL

---

### Frontend

* React
* TypeScript
* Vite
* TanStack Query
* Wouter

---

## 🗂️ Architecture

```
/web      → React frontend
/server      → Express + tRPC API
/shared      → shared types (Zod schemas)
/drizzle     → migrations
```

Single deployment unit.
No microservices.
No unnecessary abstraction.

---

## ⚙️ Scripts

```bash
npm run dev         # run frontend + backend
npm run build       # build both
npm run start:prod  # run production server

npm run db:generate # generate migrations
npm run db:migrate  # apply migrations
```

---

## 🧠 Data Model (Simplified)

### Notes

* id
* title
* content (nullable)
* userId
* createdAt
* updatedAt

---

### Themes

* id
* name
* description
* synopsis (JSON string)
* synopsisUpdatedAt
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
* Let Postgres do the heavy lifting

---

### 4. AI as a Layer (Not Core)

Unlike typical apps:

* AI is **additive**, not foundational
* The system must work without it
* AI enhances thinking, not replaces it

---

## ❌ What We Avoid

From the original philosophy :

* graph views
* plugin systems
* over-designed UI
* collaboration features
* mobile apps (for now)
* complex editors
* unnecessary state management

---

## 🎯 Current Status

✅ Auth working (magic links + sessions)
✅ Notes CRUD working
✅ Themes system implemented
✅ Theme-note linking
✅ Synopsis pipeline scaffolded
⚠️ Migrations / schema discipline still stabilizing
⚠️ Search vector system in flux

---

## 🔮 Where This Is Going

This evolves into:

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
 Tim Denning-style obsession
* my own **Faktor_10 philosophy**

---

## ⚡ Final Note

This is not a productivity app.

It is a **thinking weapon**.

Build it fast.
Keep it simple.
Let it evolve.


