import { createClient, type Client } from "@libsql/client/web";
import type { Env } from "./env";

/** Per-request libSQL client. Workers need the /web build (HTTP, no file: URLs). */
export function createDb(env: Env): Client {
  if (!env.TURSO_DATABASE_URL) {
    throw new Error("TURSO_DATABASE_URL unset");
  }
  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

/** Minimal surface the app needs; lets tests pass a Node libSQL client. */
export type Db = Pick<Client, "execute">;
