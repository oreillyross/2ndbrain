import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { AppEnv, Env } from "./env";

export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

// One JWKS per team domain, cached at module scope so keys are fetched once
// per isolate rather than once per request.
const jwksCache = new Map<string, JWTVerifyGetKey>();

function remoteJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", teamDomain));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * The Access issuer is always `https://<team>.cloudflareaccess.com`. Accept the
 * setting with or without the scheme and with or without a trailing slash.
 */
export function teamOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function parseAllowedEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isLocalHost(url: string): boolean {
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** Dev bypass: needs ENVIRONMENT=development, DEV_EMAIL, and a localhost request. */
function devEmail(env: Env, url: string): string | null {
  if (env.ENVIRONMENT === "development" && env.DEV_EMAIL && isLocalHost(url)) {
    return env.DEV_EMAIL.toLowerCase();
  }
  return null;
}

type Options = {
  /** Override key resolution (tests). Defaults to the team's remote JWKS. */
  jwks?: JWTVerifyGetKey;
};

/**
 * Verifies the Cloudflare Access JWT and sets `c.var.user`.
 * Fails closed: missing config → 500, missing/invalid token or email not
 * allowlisted → 401/403. Never trusts Cf-Access-Authenticated-User-Email.
 */
export function accessAuth(options: Options = {}) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const dev = devEmail(c.env, c.req.url);
    if (dev) {
      c.set("user", { email: dev });
      return next();
    }

    const { POLICY_AUD } = c.env;
    const TEAM_DOMAIN = c.env.TEAM_DOMAIN?.trim() ? teamOrigin(c.env.TEAM_DOMAIN) : "";
    const allowed = parseAllowedEmails(c.env.ALLOWED_EMAILS);
    if (!TEAM_DOMAIN || !POLICY_AUD || allowed.size === 0) {
      console.error("access: TEAM_DOMAIN, POLICY_AUD or ALLOWED_EMAILS unset");
      return c.json({ error: "server misconfigured" }, 500);
    }

    const token = c.req.header(ACCESS_JWT_HEADER);
    if (!token) return c.json({ error: "unauthorized" }, 401);

    let email: unknown;
    try {
      const { payload } = await jwtVerify(
        token,
        options.jwks ?? remoteJwks(TEAM_DOMAIN),
        {
          issuer: TEAM_DOMAIN,
          audience: POLICY_AUD,
          algorithms: ["RS256"],
        },
      );
      email = payload.email;
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }

    if (typeof email !== "string" || !allowed.has(email.toLowerCase())) {
      return c.json({ error: "forbidden" }, 403);
    }

    c.set("user", { email: email.toLowerCase() });
    return next();
  });
}
