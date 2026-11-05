import { describe, it, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { applyMigrations } from "./migrate";

let db: Client;

async function seed() {
  await db.batch(
    [
      "insert into users (id, email) values ('ua', 'a@x'), ('ub', 'b@x')",
      "insert into notes (id, user_id, title, content) values ('na1', 'ua', 'Running shoes', 'The runners were running fast')",
      "insert into notes (id, user_id, title, content) values ('na2', 'ua', 'Cafe notes', 'Café au lait, crème brûlée')",
      "insert into notes (id, user_id, title, content) values ('nb1', 'ub', 'B private run', 'Bob runs too')",
    ],
    "write",
  );
}

async function search(userId: string, match: string) {
  const r = await db.execute({
    sql: `select n.id from notes_fts
          join notes n on n.rid = notes_fts.rowid
          where notes_fts match ? and n.user_id = ?
          order by bm25(notes_fts)`,
    args: [match, userId],
  });
  return r.rows.map((row) => row.id);
}

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await applyMigrations(db);
});

describe("migrations", () => {
  it("apply to an empty database", async () => {
    const r = await db.execute(
      "select name from sqlite_master where type in ('table','trigger') and name not like 'sqlite_%' and name not like '__drizzle%' order by name",
    );
    const names = r.rows.map((x) => x.name);
    for (const t of ["users", "notes", "themes", "links", "notes_fts", "notes_fts_ai", "notes_fts_ad", "notes_fts_au"]) {
      expect(names).toContain(t);
    }
    expect(names).not.toContain("tags");
  });

  it("are idempotent", async () => {
    await expect(applyMigrations(db)).resolves.not.toThrow();
  });
});

describe("constraints", () => {
  beforeEach(seed);

  it("title is unique per user, not globally", async () => {
    await db.execute("insert into notes (id, user_id, title) values ('nb2', 'ub', 'Running shoes')");
    await expect(
      db.execute("insert into notes (id, user_id, title) values ('na3', 'ua', 'Running shoes')"),
    ).rejects.toThrow(/UNIQUE/);
  });

  it("defaults timestamps to epoch ms and content to ''", async () => {
    await db.execute("insert into notes (id, user_id, title) values ('na3', 'ua', 'Empty')");
    const r = await db.execute("select content, created_at from notes where id = 'na3'");
    expect(r.rows[0].content).toBe("");
    expect(Math.abs(Number(r.rows[0].created_at) - Date.now())).toBeLessThan(5_000);
  });

  it("libSQL has foreign keys on by default", async () => {
    const r = await db.execute("pragma foreign_keys");
    expect(Number(r.rows[0].foreign_keys)).toBe(1);
  });

  it("enforces foreign keys when PRAGMA foreign_keys is on", async () => {
    await db.execute("pragma foreign_keys = on");
    await expect(
      db.execute("insert into notes (id, user_id, title) values ('nx', 'no-such-user', 't')"),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it("cascades link deletes and nulls to_note_id when FKs are on", async () => {
    await db.execute("pragma foreign_keys = on");
    await db.execute(
      "insert into links (id, user_id, from_note_id, to_note_id, to_title) values ('l1','ua','na1','na2','Cafe notes'), ('l2','ua','na2','na1','Running shoes')",
    );
    await db.execute("delete from notes where id = 'na2'");
    const r = await db.execute("select id, to_note_id from links order by id");
    expect(r.rows.map((x) => [x.id, x.to_note_id])).toEqual([["l1", null]]);
  });
});

describe("FTS5", () => {
  beforeEach(seed);

  it("matches with porter stemming", async () => {
    expect(await search("ua", "run")).toEqual(["na1"]);
  });

  it("ignores diacritics", async () => {
    expect(await search("ua", "cafe")).toEqual(["na2"]);
    expect(await search("ua", "creme")).toEqual(["na2"]);
  });

  it("is owner-scoped through the join", async () => {
    expect(await search("ub", "run")).toEqual(["nb1"]);
    expect(await search("ub", "cafe")).toEqual([]);
  });

  it("follows updates to title/content", async () => {
    await db.execute("update notes set content = 'nothing here' where id = 'na1'");
    await db.execute("update notes set title = 'Walking' where id = 'na1'");
    expect(await search("ua", "run")).toEqual([]);
    expect(await search("ua", "walking")).toEqual(["na1"]);
  });

  it("does not reindex on unrelated updates", async () => {
    await db.execute("insert into themes (id, user_id, name) values ('t1', 'ua', 'T')");
    await db.execute("update notes set theme_id = 't1' where id = 'na1'");
    expect(await search("ua", "run")).toEqual(["na1"]);
  });

  it("drops deleted notes", async () => {
    await db.execute("delete from notes where id = 'na1'");
    expect(await search("ua", "run")).toEqual([]);
  });

  it("index stays consistent with the content table", async () => {
    await db.execute("update notes set content = 'changed' where id = 'na2'");
    await db.execute("delete from notes where id = 'nb1'");
    await expect(
      db.execute("insert into notes_fts(notes_fts, rank) values ('integrity-check', 1)"),
    ).resolves.toBeDefined();
  });
});
