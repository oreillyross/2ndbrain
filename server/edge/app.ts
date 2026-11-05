import { Hono } from "hono";
import type { JWTVerifyGetKey } from "jose";
import { accessAuth } from "./access";
import type { Client } from "@libsql/client/web";
import { createLibsqlClient } from "./db";
import type { AppEnv, Env } from "./env";

type Deps = {
  jwks?: JWTVerifyGetKey;
  db?: (env: Env) => Pick<Client, "execute">;
};

export function createApp(deps: Deps = {}) {
  const app = new Hono<AppEnv>();
  const getDb = deps.db ?? createLibsqlClient;

  // Everything the Worker serves itself sits behind Access verification.
  // Static assets are served by the asset binding before the Worker runs.
  app.use("/api/*", accessAuth({ jwks: deps.jwks }));
  app.use("/trpc/*", accessAuth({ jwks: deps.jwks }));

  app.get("/api/health", async (c) => {
    let db: "ok" | "error" = "ok";
    try {
      await getDb(c.env).execute("select 1");
    } catch (err) {
      console.error("health: db check failed", err);
      db = "error";
    }
    return c.json({ email: c.var.user.email, db }, db === "ok" ? 200 : 503);
  });

  app.notFound((c) => c.json({ error: "not found" }, 404));

  return app;
}
