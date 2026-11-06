import { createClient, type Client } from "@libsql/client";
import { applyMigrations } from "../db/migrate";
import { makeDb, type DB } from "../db/client";
import { forUser, upsertUserByEmail } from "../db/repo";

/** libSQL client that counts DB round trips (each execute/batch/transaction = 1). */
export function countingClient(inner: Client) {
  const counter = { n: 0 };
  const client = new Proxy(inner, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (
        typeof v === "function" &&
        (prop === "execute" || prop === "batch" || prop === "transaction" || prop === "executeMultiple")
      ) {
        return (...args: unknown[]) => {
          counter.n++;
          return (v as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
  return { client, counter };
}

export type TestDb = {
  raw: Client;
  db: DB;
  counter: { n: number };
  /** Run fn and return how many round trips it made. */
  roundTrips: (fn: () => Promise<unknown>) => Promise<number>;
};

export async function testDb(): Promise<TestDb> {
  const raw = createClient({ url: ":memory:" });
  await applyMigrations(raw);
  const { client, counter } = countingClient(raw);
  const db = makeDb(client);
  return {
    raw,
    db,
    counter,
    async roundTrips(fn) {
      const before = counter.n;
      await fn();
      return counter.n - before;
    },
  };
}

export async function twoUsers(t: TestDb) {
  const a = await upsertUserByEmail(t.db, "a@example.com");
  const b = await upsertUserByEmail(t.db, "b@example.com");
  return { a, b, repoA: forUser(t.db, a.id), repoB: forUser(t.db, b.id) };
}
