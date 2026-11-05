export type Env = {
  ASSETS: Fetcher;
  /** Cloudflare Access team domain, e.g. https://myteam.cloudflareaccess.com */
  TEAM_DOMAIN?: string;
  /** Application Audience (AUD) tag of the Access application */
  POLICY_AUD?: string;
  /** Comma-separated allowlist, checked after JWT verification */
  ALLOWED_EMAILS?: string;
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  OPENAI_API_KEY?: string;
  /** Local dev only (.dev.vars). Never set in wrangler.jsonc. */
  ENVIRONMENT?: string;
  DEV_EMAIL?: string;
};

export type AuthUser = { email: string };

export type AppEnv = {
  Bindings: Env;
  Variables: { user: AuthUser };
};
