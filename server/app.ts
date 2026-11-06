import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { MiddlewareHandler } from "hono";
import { trpcServer } from "@hono/trpc-server";
import type { JWTVerifyGetKey } from "jose";
import type { Client } from "@libsql/client/web";
import { accessAuth } from "./access";
import { createLibsqlClient, makeDb } from "./db/client";
import { forUser, upsertUserByEmail } from "./db/repo";
import { openAiSummariser, type Summariser } from "./ai";
import { appRouter } from "./trpc/router";
import type { Context } from "./trpc/context";
import type { AppEnv, Env } from "./env";

/** Max procedures per batched tRPC request (one Worker invocation). Client sets maxItems to match. */
export const MAX_BATCH = 10;

type LibsqlClient = Pick<Client, "execute" | "batch">;

type Deps = {
  /** Identity middleware that sets c.var.user. Defaults to Cloudflare Access verification. */
  auth?: MiddlewareHandler<AppEnv>;
  jwks?: JWTVerifyGetKey;
  /** libSQL client factory; defaults to the per-request web client from env. */
  client?: (env: Env) => LibsqlClient;
  ai?: (env: Env) => Summariser;
};

/**
 * Rejects cross-site writes: non-GET requests must carry an Origin header
 * whose host equals the request host. Host (not scheme) is compared so the
 * check is independent of how TLS is terminated in front of the Worker.
 */
const sameOriginWrites = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const origin = c.req.header("Origin");
    let originHost: string | null = null;
    try {
      originHost = origin ? new URL(origin).host : null;
    } catch {
      originHost = null;
    }
    if (!originHost || originHost !== new URL(c.req.url).host) {
      return c.json({ error: "bad origin" }, 403);
    }
  }
  return next();
});

/** Caps tRPC batch size: /trpc/a,b,c is three procedures. */
const batchLimit = createMiddleware<AppEnv>(async (c, next) => {
  const path = new URL(c.req.url).pathname.slice("/trpc/".length);
  if (path.split(",").length > MAX_BATCH) {
    return c.json({ error: "batch too large" }, 413);
  }
  return next();
});

export function createApp(deps: Deps = {}) {
  const app = new Hono<AppEnv>();
  const getClient = deps.client ?? createLibsqlClient;
  const getAi = deps.ai ?? ((env: Env) => openAiSummariser(env.OPENAI_API_KEY));
  // Per-isolate cache: user ids never change once created.
  const userCache = new Map<string, { id: string; email: string }>();

  // Everything the Worker serves itself sits behind Access verification.
  // Static assets are served by the asset binding before the Worker runs.
  const auth = deps.auth ?? accessAuth({ jwks: deps.jwks });
  app.use("/api/*", auth);
  app.use("/trpc/*", auth, sameOriginWrites, batchLimit);

  app.get("/api/health", async (c) => {
    let db: "ok" | "error" = "ok";
    try {
      await getClient(c.env).execute("select 1");
    } catch (err) {
      console.error("health: db check failed", err);
      db = "error";
    }
    return c.json({ email: c.var.user.email, db }, db === "ok" ? 200 : 503);
  });

  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      endpoint: "/trpc",
      createContext: async (_opts, c): Promise<Context> => {
        const env = c.env as Env;
        const email = (c.get("user") as { email: string }).email;
        const db = makeDb(getClient(env));
        let user = userCache.get(email);
        if (!user) {
          user = await upsertUserByEmail(db, email);
          userCache.set(email, user);
        }
        return { user, repo: forUser(db, user.id), ai: getAi(env) };
      },
      onError: ({ error, path }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.error(`trpc ${path}:`, error.cause ?? error);
        }
      },
    }),
  );

  app.notFound((c) => c.json({ error: "not found" }, 404));

  return app;
}
