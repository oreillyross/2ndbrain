# Deploying the Worker (Phase 1)

One-time setup. Nothing here is automated; Access is configured in the dashboard, not in code.

## 1. Turso

```bash
turso db create 2ndbrain
turso db show 2ndbrain --url          # → TURSO_DATABASE_URL
turso db tokens create 2ndbrain       # → TURSO_AUTH_TOKEN
turso db create 2ndbrain-dev          # for `npm run dev:worker`
```

## 2. First deploy

```bash
npx wrangler login
npx wrangler secret put TURSO_DATABASE_URL
npx wrangler secret put TURSO_AUTH_TOKEN
npm run deploy
```

With `TEAM_DOMAIN`, `POLICY_AUD` and `ALLOWED_EMAILS` still empty, every `/api/*` and `/trpc/*` request returns 500 (fail closed). That is expected until step 3.

## 3. Cloudflare Access

1. Workers & Pages → `2ndbrain` → Settings → Domains & Routes → `workers.dev` → **Enable Cloudflare Access**.
2. Zero Trust → Access → Applications → the new app → Policies: one **Allow** policy, selector **Emails**, your address only. Login method: one-time PIN (and/or Google).
3. Copy the app's **Application Audience (AUD) tag** and your team domain (`https://<team>.cloudflareaccess.com`).
4. Put them in `wrangler.jsonc` `vars` (`POLICY_AUD`, `TEAM_DOMAIN`) along with `ALLOWED_EMAILS` (same address), then `npm run deploy` again.

## 4. Acceptance checks (Phase 1 "done when")

- [ ] Browser, allowed email: `https://2ndbrain.<sub>.workers.dev/api/health` → `{"email":"…","db":"ok"}`
- [ ] Private window, other email: no PIN is sent / Access blocks
- [ ] `curl -i https://2ndbrain.<sub>.workers.dev/api/health` (no cookie) → Access redirect/403, never JSON
- [ ] Preview URLs off: Settings → Domains & Routes shows no preview URL
- [ ] Workers → Metrics: CPU time per request well under 10 ms

## Local dev

```bash
cp .dev.vars.example .dev.vars   # fill in the 2ndbrain-dev URL and token
npm run dev:worker               # http://localhost:8787/api/health
```

The dev bypass only works when `ENVIRONMENT=development`, `DEV_EMAIL` is set **and** the request hostname is localhost. `wrangler.jsonc` must never contain `ENVIRONMENT` or `DEV_EMAIL`.
