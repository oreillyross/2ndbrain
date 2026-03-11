# Project: Simple Zettelkasten

Purpose:

Build the simplest possible browser-based Zettelkasten system.

The goal is **thinking clarity**, not feature richness.

This project intentionally rejects most knowledge app features.

---

# Philosophy

This tool must remain:

- fast
- simple
- boring
- minimal

If a feature slows thinking or adds UI complexity, it should not be added.

The user should be able to:

1. create a note in < 2 seconds
2. search instantly
3. link ideas effortlessly

---

# Tech Constraints

These constraints are strict.

Backend:
- Node
- Express
- tRPC
- Zod
- Drizzle ORM
- Postgres

Frontend:
- React
- Typescript
- Vite
- Tanstack Query
- tRPC client

No additional frameworks without strong justification.

---

# Feature Constraints

V1 only includes:

- create note
- edit note
- search notes
- wiki-style linking `[[note]]`
- backlinks
- tags

Nothing else.

---

# Explicitly Forbidden Features (V1)

Do NOT implement:

- graph view
- markdown rendering
- plugins
- themes
- collaboration
- mobile apps
- sync engines
- offline mode
- folders
- nested notebooks
- block editors
- AI features

If a feature is not required for writing and linking notes, it is unnecessary.

---

# UI Constraints

UI must remain minimal.

Allowed UI elements:

- note editor
- search bar
- backlinks panel
- tag list

No complex layout systems.

---

# Engineering Rules

Prefer:

- vertical feature slices
- simple database queries
- readable code
- boring architecture

Avoid:

- premature abstraction
- microservices
- event systems
- complex caching
- unnecessary state managers

---

# Performance Goals

Search results must return in <100ms.

Note creation must feel instantaneous.

---

# Code Philosophy

If a feature requires more than ~200 lines of code, question whether it belongs.

If something can be solved with simple SQL instead of application logic, use SQL.

---

# AI Usage

AI features are **explicitly forbidden in V1**.

Possible V2 ideas:

- automatic tagging
- note summarization
- knowledge clustering

But these should only be considered after the core system is stable.

---

# Success Criteria

The project is successful if:

- it can hold 10,000 notes
- search is fast
- linking works reliably
- the UI is frictionless

If users enjoy writing and connecting ideas, the project succeeded.

---

# Guiding Question

Before adding any feature ask:

"Does this make thinking faster?"

If not, do not build it.
