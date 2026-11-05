/**
 * Node entrypoint (Railway / any container). Same Hono app and tRPC routers as
 * the Worker, with:
 *  - HTTP Basic auth over the whole site instead of Cloudflare Access
 *  - a Node libSQL client (local SQLite file on a volume, or Turso)
 *  - migrations applied at boot
 *  - static files from dist/ with SPA fallback and the headers from dist/_headers
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createClient } from "@libsql/client";
import { createApp } from "./app";
import { basicAuthIdentity } from "./basicAuth";
import { applyMigrations } from "./db/migrate";
import { openAiSummariser } from "./ai";
import type { AppEnv } from "./env";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is required`);
    process.exit(1);
  }
  return v;
}

/** Parse the `/*` block of a Cloudflare-style _headers file. */
function loadHeaders(file: string): [string, string][] {
  if (!existsSync(file)) return [];
  const out: [string, string][] = [];
  let inAll = false;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      inAll = line.trim() === "/*";
      continue;
    }
    const i = line.indexOf(":");
    if (inAll && i > 0) out.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return out;
}

async function main() {
  const auth = basicAuthIdentity({
    username: required("BASIC_AUTH_USER"),
    password: required("BASIC_AUTH_PASSWORD"),
    email: required("APP_USER_EMAIL"),
  });

  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/2ndbrain.db";
  if (url.startsWith("file:")) {
    mkdirSync(dirname(resolve(url.slice("file:".length))), { recursive: true });
  }
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await applyMigrations(client);

  const api = createApp({
    auth,
    client: () => client,
    ai: () => openAiSummariser(process.env.OPENAI_API_KEY),
  });

  const distDir = resolve(process.env.DIST_DIR ?? "dist");
  const headers = loadHeaders(resolve(distDir, "_headers"));

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    await next();
    for (const [k, v] of headers) c.header(k, v);
  });
  // Unauthenticated liveness probe for the platform health check; reveals nothing.
  app.get("/healthz", (c) => c.text("ok"));
  app.use("*", auth);
  app.route("/", api);
  app.all("/api/*", (c) => c.json({ error: "not found" }, 404));
  app.all("/trpc/*", (c) => c.json({ error: "not found" }, 404));
  app.use("/*", serveStatic({ root: distDir }));
  app.get("*", serveStatic({ path: resolve(distDir, "index.html") }));

  const port = Number(process.env.PORT ?? 8080);
  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    console.log(`2ndbrain listening on :${port} (db: ${url.startsWith("file:") ? url : "remote libSQL"})`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
