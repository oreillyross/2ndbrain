# Running the MVP on Railway

Railway runs the **Node entrypoint** (`server/node.ts`): the same Hono app and tRPC routers as the Cloudflare Worker, with two swaps:

| | Cloudflare Worker (target) | Railway / Node (MVP, UI acceptance) |
|---|---|---|
| Login | Cloudflare Access (JWT verified) | HTTP Basic auth over the whole site |
| DB | Turso over HTTPS | SQLite file on a Railway volume (or Turso) |
| Static files | Workers assets + `_headers` | `serveStatic` from `dist/` + the same `_headers` |

## Steps

1. **New service from the repo**, branch `cf-turso` (or this PR's branch). Railway picks up `railway.json` → builds the `Dockerfile`.
2. **Add a volume** mounted at `/data`. The SQLite DB lives at `/data/2ndbrain.db` and survives redeploys. Without a volume, data is wiped on every deploy.
3. **Variables:**

   | Name | Value |
   |---|---|
   | `BASIC_AUTH_USER` | any username |
   | `BASIC_AUTH_PASSWORD` | a long random password |
   | `APP_USER_EMAIL` | your email (the app user all data belongs to) |
   | `OPENAI_API_KEY` | optional; only needed for theme summaries |
   | `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | optional; set to use Turso instead of the volume |

   The server refuses to start if any of the first three is missing.
4. **Generate a domain** (Settings → Networking). Open it, enter the basic-auth credentials, start writing.

Health check: `/healthz` (unauthenticated, returns `ok`). `/api/health` (authenticated) also checks the DB.

## Old Railway service

The previous Express + Postgres service is unrelated to this one. Point the new service at a fresh volume; nothing is migrated (blank slate).

## Local

```bash
npm run build:web && npm run dev:node   # http://localhost:8080, user dev / pass dev
```

## Known MVP limitations

- **Logout** links to Cloudflare Access's logout URL, which doesn't exist on Railway. To log out of basic auth, close the browser.
- Single user: everyone with the basic-auth password is the same app user.
