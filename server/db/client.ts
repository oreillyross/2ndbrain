import { createClient, type Client } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql/web";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import type { Env } from "../env";

export type DB = LibSQLDatabase<typeof schema>;

/** Per-request libSQL client. Workers need the /web build (HTTP, no file: URLs). */
export function createLibsqlClient(env: Env): Client {
  if (!env.TURSO_DATABASE_URL) {
    throw new Error("TURSO_DATABASE_URL unset");
  }
  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

/** Wraps any libSQL client (web build in the Worker, Node build in tests/Node server). */
export function makeDb(client: Pick<Client, "execute" | "batch">): DB {
  return drizzle({ client: client as Client, schema });
}
