import { createClient } from "@libsql/client";
import { exportDb, writeSnapshot, readSnapshot, restoreDb, verifySnapshot, countsOf } from "./backup";

/**
 * npm run backup -- export  <dir>   source: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
 * npm run backup -- verify  <dir>   restore drill into a scratch DB (default :memory:)
 * npm run backup -- restore <dir>   target: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (must be empty)
 *
 * `verify` uses SCRATCH_DATABASE_URL / SCRATCH_AUTH_TOKEN when set, e.g. a
 * throwaway Turso database, otherwise an in-memory SQLite database.
 * Never prints note content or tokens.
 */

function dbFromEnv() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
}

async function main() {
  const [cmd, dir] = process.argv.slice(2);
  if (!cmd || !dir || !["export", "verify", "restore"].includes(cmd)) {
    console.error("usage: backup <export|verify|restore> <dir>");
    process.exit(2);
  }

  if (cmd === "export") {
    const client = dbFromEnv();
    const snap = await exportDb(client);
    writeSnapshot(dir, snap);
    client.close();
    console.log(`exported ${JSON.stringify(countsOf(snap))} to ${dir}`);
  } else if (cmd === "verify") {
    const scratch = createClient({
      url: process.env.SCRATCH_DATABASE_URL ?? ":memory:",
      authToken: process.env.SCRATCH_AUTH_TOKEN,
    });
    const counts = await verifySnapshot(dir, scratch);
    scratch.close();
    console.log(`restore drill ok: ${JSON.stringify(counts)}`);
  } else {
    const snap = readSnapshot(dir);
    const client = dbFromEnv();
    await restoreDb(client, snap);
    client.close();
    console.log(`restored ${JSON.stringify(countsOf(snap))} from ${dir}`);
  }
}

main().catch((err) => {
  console.error(`backup failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
