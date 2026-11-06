import { basicAuth } from "hono/basic-auth";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./env";

/**
 * Identity for the Node/Railway deployment, where Cloudflare Access is not in
 * front of the app: HTTP Basic auth (constant-time compare inside Hono) mapped
 * to a single app user email. Only use over HTTPS.
 */
export function basicAuthIdentity(opts: { username: string; password: string; email: string }) {
  const check = basicAuth({ username: opts.username, password: opts.password, realm: "2ndBrain" });
  const email = opts.email.toLowerCase();
  return createMiddleware<AppEnv>(async (c, next) =>
    check(c, async () => {
      c.set("user", { email });
      await next();
    }),
  );
}
