# Deploying 2ndBrain to Cloudflare

One deployment unit: a single Cloudflare Worker that serves the built React app as **static assets** and runs the **Hono + tRPC API at the edge**, with data in **Turso** (libSQL / SQLite). Everything fits the free tiers.

```
Browser ──► Cloudflare Access (login) ──► Worker "2ndbrain"
                                            ├─ static assets (dist/, SPA fallback, _headers)
                                            └─ /api/*, /trpc/*  → Hono + tRPC ──HTTPS──► Turso
```

- `wrangler.jsonc` → `assets.directory: ./dist`, `not_found_handling: single-page-application`. Asset requests never invoke the Worker (free, no CPU budget).
- `run_worker_first: ["/api/*", "/trpc/*"]` → only API calls run Worker code.
- The Worker talks to Turso over HTTPS with `@libsql/client/web`, a client per request from `env`.
- `web/public/_headers` (CSP etc.) is copied into `dist/` and applied by Workers assets.

Access is configured in the dashboard, not in code.

## 1. Turso

```bash
turso db create 2ndbrain
turso db show 2ndbrain --url          # → TURSO_DATABASE_URL
turso db tokens create 2ndbrain       # → TURSO_AUTH_TOKEN
turso db create 2ndbrain-dev          # for local dev
```

Apply the schema (tables + FTS5 search index) to each database:

```bash
TURSO_DATABASE_URL=libsql://2ndbrain-<org>.turso.io TURSO_AUTH_TOKEN=... npm run db:migrate
```

Run this again whenever a new file lands in `migrations/`. Never use `drizzle-kit push` (it doesn't know about the FTS5 table and triggers).

## 2. First deploy

```bash
npx wrangler login
npx wrangler secret put TURSO_DATABASE_URL
npx wrangler secret put TURSO_AUTH_TOKEN
npx wrangler secret put OPENAI_API_KEY   # optional: only for theme summaries
npm run deploy                           # vite build → dist/, then wrangler deploy
```

With `TEAM_DOMAIN`, `POLICY_AUD` and `ALLOWED_EMAILS` still empty, every `/api/*` and `/trpc/*` request returns 500 (fail closed). That is expected until step 3.

## 3. Cloudflare Access

1. Workers & Pages → `2ndbrain` → Settings → Domains & Routes → `workers.dev` → **Enable Cloudflare Access**.
2. Zero Trust → Access → Applications → the new app → Policies: one **Allow** policy, selector **Emails**, your address only. Login method: one-time PIN (and/or Google).
3. Copy the app's **Application Audience (AUD) tag** and your team domain (`https://<team>.cloudflareaccess.com`).
4. Put them in `wrangler.jsonc` `vars` (`POLICY_AUD`, `TEAM_DOMAIN`) along with `ALLOWED_EMAILS` (same address), commit, then `npm run deploy` again.

## 4. Acceptance checks

- [ ] Browser, allowed email: `https://2ndbrain.<sub>.workers.dev/` loads the app; create a note, search for it, reload
- [ ] `https://2ndbrain.<sub>.workers.dev/api/health` → `{"email":"…","db":"ok"}`
- [ ] Private window, other email: no PIN is sent / Access blocks
- [ ] `curl -i https://2ndbrain.<sub>.workers.dev/api/health` (no cookie) → Access redirect/403, never JSON
- [ ] Preview URLs off: Settings → Domains & Routes shows no preview URL
- [ ] Workers → Metrics: CPU time per request well under 10 ms

## Deploying from GitHub (optional)

`.github/workflows/deploy.yml` runs on pushes to `main` (and manually). It typechecks, tests, applies migrations to Turso, builds and deploys. It is skipped until these repository secrets exist (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API token with the **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | Workers & Pages overview → Account ID |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | production database (used for migrations only; the Worker reads its own secrets) |

## Local dev

```bash
cp .dev.vars.example .dev.vars   # fill in the 2ndbrain-dev URL and token
npm run dev                      # Vite on :3000 (HMR) proxying /api,/trpc to wrangler dev on :8787
npm run preview                  # or: production build served by wrangler dev on :8787, assets included
```

`turso dev` gives a local libSQL server at `http://127.0.0.1:8080` if you'd rather not use a cloud dev DB (run `npm run db:migrate` against it first).

The dev bypass only works when `ENVIRONMENT=development`, `DEV_EMAIL` is set **and** the request hostname is localhost. `wrangler.jsonc` must never contain `ENVIRONMENT` or `DEV_EMAIL`.
