import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Client } from "@libsql/client";

export const MIGRATIONS_FOLDER = new URL("../../migrations", import.meta.url).pathname;

/** Apply all migrations (Node only: reads the migrations folder from disk). */
export async function applyMigrations(client: Client) {
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
}
