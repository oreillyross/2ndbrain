import type { Config } from "drizzle-kit";

// Never use `drizzle-kit push`: it does not know about the hand-written FTS5
// virtual table and triggers and can drop them. Use generate + migrate.
export default {
  schema: "./server/db/schema.ts",
  out: "./migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
