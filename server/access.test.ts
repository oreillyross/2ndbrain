import { describe, it, expect, beforeAll } from "vitest";
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
} from "jose";
import { createClient } from "@libsql/client";
import { createApp } from "./app";
import type { Env } from "./env";

const TEAM = "https://team.cloudflareaccess.com";
const AUD = "aud-tag-123";
const ME = "ross@example.com";
const PROD_URL = "https://2ndbrain.example.workers.dev/api/health";

let privateKey: CryptoKey;
let otherKey: CryptoKey;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  jwks = createLocalJWKSet({ keys: [jwk] });
});

function sign(
  claims: Record<string, unknown> = {},
  opts: { key?: CryptoKey; aud?: string; iss?: string; exp?: string | number } = {},
) {
  return new SignJWT({ email: ME, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? TEAM)
    .setAudience(opts.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "5m")
    .sign(opts.key ?? privateKey);
}

const prodEnv = (over: Partial<Env> = {}): Env =>
  ({
    TEAM_DOMAIN: TEAM,
    POLICY_AUD: AUD,
    ALLOWED_EMAILS: `${ME}, other@example.com`,
    TURSO_DATABASE_URL: "unused",
    ...over,
  }) as Env;

const memDb = () => createClient({ url: ":memory:" });

function app() {
  return createApp({ jwks, client: memDb });
}

async function get(env: Env, token?: string, url = PROD_URL) {
  const headers: Record<string, string> = {};
  if (token) headers["Cf-Access-Jwt-Assertion"] = token;
  return app().request(url, { headers }, env);
}

describe("Access JWT middleware", () => {
  it("allows a valid token for an allowlisted email and checks the DB", async () => {
    const res = await get(prodEnv(), await sign());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: ME, db: "ok" });
  });

  it("matches the allowlist case-insensitively", async () => {
    const res = await get(prodEnv(), await sign({ email: "Ross@Example.com" }));
    expect(res.status).toBe(200);
  });

  it("accepts TEAM_DOMAIN written as a bare hostname", async () => {
    const env = prodEnv({ TEAM_DOMAIN: "team.cloudflareaccess.com/" });
    expect((await get(env, await sign())).status).toBe(200);
  });

  it("rejects a missing JWT in production", async () => {
    expect((await get(prodEnv())).status).toBe(401);
  });

  it("ignores Cf-Access-Authenticated-User-Email without a JWT", async () => {
    const res = await app().request(
      PROD_URL,
      { headers: { "Cf-Access-Authenticated-User-Email": ME } },
      prodEnv(),
    );
    expect(res.status).toBe(401);
  });

  it("rejects a token signed by another key", async () => {
    expect((await get(prodEnv(), await sign({}, { key: otherKey }))).status).toBe(401);
  });

  it("rejects the wrong audience", async () => {
    expect((await get(prodEnv(), await sign({}, { aud: "other-app" }))).status).toBe(401);
  });

  it("rejects the wrong issuer", async () => {
    const iss = "https://evil.cloudflareaccess.com";
    expect((await get(prodEnv(), await sign({}, { iss }))).status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    expect((await get(prodEnv(), await sign({}, { exp }))).status).toBe(401);
  });

  it("rejects garbage", async () => {
    expect((await get(prodEnv(), "not.a.jwt")).status).toBe(401);
  });

  it("rejects a valid token for an email not on the allowlist", async () => {
    const res = await get(prodEnv(), await sign({ email: "stranger@example.com" }));
    expect(res.status).toBe(403);
  });

  it("rejects a token without an email claim", async () => {
    expect((await get(prodEnv(), await sign({ email: undefined }))).status).toBe(403);
  });

  it.each([
    ["TEAM_DOMAIN", { TEAM_DOMAIN: undefined }],
    ["POLICY_AUD", { POLICY_AUD: undefined }],
    ["ALLOWED_EMAILS", { ALLOWED_EMAILS: " , " }],
  ])("fails closed when %s is unset", async (_name, over) => {
    const res = await get(prodEnv(over as Partial<Env>), await sign());
    expect(res.status).toBe(500);
  });

  it("protects /trpc/* too", async () => {
    const res = await app().request(
      "https://2ndbrain.example.workers.dev/trpc/auth.me",
      {},
      prodEnv(),
    );
    expect(res.status).toBe(401);
  });
});

describe("dev bypass", () => {
  const devEnv = (over: Partial<Env> = {}) =>
    ({ ENVIRONMENT: "development", DEV_EMAIL: "dev@example.com", ...over }) as Env;

  it("works on localhost with ENVIRONMENT=development and DEV_EMAIL", async () => {
    const res = await get(devEnv(), undefined, "http://localhost:8787/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "dev@example.com", db: "ok" });
  });

  it("does not apply on a non-local hostname", async () => {
    const res = await get(devEnv(), undefined, PROD_URL);
    expect(res.status).toBe(500); // falls through to fail-closed config check
  });

  it("does not apply without ENVIRONMENT=development", async () => {
    const res = await get(
      devEnv({ ENVIRONMENT: "production" }),
      undefined,
      "http://localhost:8787/api/health",
    );
    expect(res.status).toBe(500);
  });

  it("does not apply without DEV_EMAIL", async () => {
    const res = await get(
      devEnv({ DEV_EMAIL: undefined }),
      undefined,
      "http://localhost:8787/api/health",
    );
    expect(res.status).toBe(500);
  });
});

describe("health", () => {
  it("reports db error as 503 without leaking details", async () => {
    const broken = createApp({
      jwks,
      client: () => ({
        execute: async () => {
          throw new Error("secret connection string");
        },
        batch: async () => [],
      }),
    });
    const res = await broken.request(
      PROD_URL,
      { headers: { "Cf-Access-Jwt-Assertion": await sign() } },
      prodEnv(),
    );
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("secret");
  });
});
