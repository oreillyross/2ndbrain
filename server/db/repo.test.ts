import { describe, it, expect, beforeEach } from "vitest";
import { forUser, toFtsQuery, upsertUserByEmail, type Repo } from "./repo";
import { testDb, type TestDb } from "../test/helpers";

let t: TestDb;
let repo: Repo;

beforeEach(async () => {
  t = await testDb();
  const u = await upsertUserByEmail(t.db, "me@example.com");
  repo = forUser(t.db, u.id);
});

describe("users", () => {
  it("upsert returns the same user for the same email", async () => {
    const a = await upsertUserByEmail(t.db, "x@example.com");
    const b = await upsertUserByEmail(t.db, "x@example.com");
    expect(a.id).toBe(b.id);
  });

  it("costs 1 round trip for an existing user, 2 on first login", async () => {
    expect(await t.roundTrips(() => upsertUserByEmail(t.db, "new@example.com"))).toBe(2);
    expect(await t.roundTrips(() => upsertUserByEmail(t.db, "new@example.com"))).toBe(1);
  });
});

describe("notes", () => {
  it("create / getById / getByTitle / update", async () => {
    const n = await repo.notes.create({ title: "First" });
    expect(n).toMatchObject({ title: "First", content: "", themeId: null });
    expect(n).not.toHaveProperty("rid");
    expect(n).not.toHaveProperty("userId");
    expect(n.createdAt).toBeInstanceOf(Date);

    expect((await repo.notes.getById(n.id))?.title).toBe("First");
    expect((await repo.notes.getByTitle("First"))?.id).toBe(n.id);

    const u = await repo.notes.update({ id: n.id, title: "First!", content: "body", themeId: null });
    expect(u).toMatchObject({ title: "First!", content: "body" });
    expect(u.updatedAt.getTime()).toBeGreaterThanOrEqual(n.updatedAt.getTime());
  });

  it("rejects duplicate titles with CONFLICT", async () => {
    await repo.notes.create({ title: "Dup" });
    await expect(repo.notes.create({ title: "Dup" })).rejects.toMatchObject({ code: "CONFLICT" });
    const other = await repo.notes.create({ title: "Other" });
    await expect(
      repo.notes.update({ id: other.id, title: "Dup", content: "", themeId: null }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("list pages newest-first without content", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const n = await repo.notes.create({ title: `n${i}` });
      await t.raw.execute({ sql: "update notes set updated_at = ? where id = ?", args: [1000 + i, n.id] });
      ids.push(n.id);
    }
    const p1 = await repo.notes.list({ limit: 2 });
    expect(p1.items.map((n) => n.id)).toEqual([ids[4], ids[3]]);
    expect(p1.items[0]).not.toHaveProperty("content");
    const p2 = await repo.notes.list({ limit: 2, cursor: p1.nextCursor });
    expect(p2.items.map((n) => n.id)).toEqual([ids[2], ids[1]]);
    const p3 = await repo.notes.list({ limit: 2, cursor: p2.nextCursor });
    expect(p3.items.map((n) => n.id)).toEqual([ids[0]]);
    expect(p3.nextCursor).toBeNull();
  });

  it("list pages correctly through identical timestamps", async () => {
    for (let i = 0; i < 4; i++) await repo.notes.create({ title: `same${i}` });
    await t.raw.execute("update notes set updated_at = 5000");
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: Awaited<ReturnType<Repo["notes"]["list"]>> = await repo.notes.list({ limit: 1, cursor });
      seen.push(...page.items.map((n) => n.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(new Set(seen).size).toBe(4);
  });

  it("rejects a malformed cursor", async () => {
    await expect(repo.notes.list({ limit: 2, cursor: "x" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("delete removes outgoing links and unresolves incoming ones", async () => {
    const a = await repo.notes.create({ title: "A" });
    const b = await repo.notes.create({ title: "B" });
    const c = await repo.notes.create({ title: "C" });
    await repo.links.create({ fromId: a.id, toId: b.id, toTitle: "B" });
    await repo.links.create({ fromId: b.id, toId: c.id, toTitle: "C" });
    await repo.notes.delete(b.id);
    const rows = (await t.raw.execute("select from_note_id, to_note_id, to_title from links")).rows;
    expect(rows.map((r) => ({ ...r }))).toEqual([{ from_note_id: a.id, to_note_id: null, to_title: "B" }]);
    await expect(repo.notes.delete(b.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("themes: assign, byTheme, list counts, synopsis", async () => {
    const th = await repo.themes.create({ name: "Theme", description: "d" });
    const n = await repo.notes.create({ title: "In theme", content: "hello" });
    await repo.notes.create({ title: "Not in theme" });
    expect((await repo.notes.assignTheme({ noteId: n.id, themeId: th.id })).themeId).toBe(th.id);
    expect((await repo.notes.byTheme(th.id)).map((x) => x.id)).toEqual([n.id]);
    expect(await repo.themes.list()).toMatchObject([{ id: th.id, noteCount: 1 }]);
    expect(await repo.themes.notesForSummary(th.id)).toEqual([{ title: "In theme", content: "hello" }]);
    const s = await repo.themes.setSynopsis({ themeId: th.id, synopsis: "S", model: "m" });
    expect(s).toMatchObject({ synopsis: "S", synopsisModel: "m" });
    expect(s.synopsisUpdatedAt).toBeInstanceOf(Date);
    expect((await repo.notes.assignTheme({ noteId: n.id, themeId: null })).themeId).toBeNull();
  });

  it("links: create, getLinked, getBacklinks, delete", async () => {
    const a = await repo.notes.create({ title: "A" });
    const b = await repo.notes.create({ title: "B" });
    const l = await repo.links.create({ fromId: a.id, toId: b.id, toTitle: "B" });
    expect(await repo.links.getLinked(a.id)).toEqual([{ id: l.id, toNoteId: b.id, toTitle: "B" }]);
    expect(await repo.links.getBacklinks(b.id)).toEqual([{ id: l.id, fromNoteId: a.id, fromTitle: "A" }]);
    await repo.links.delete(l.id);
    expect(await repo.links.getLinked(a.id)).toEqual([]);
  });

  it("links a note to itself", async () => {
    const a = await repo.notes.create({ title: "Self" });
    await expect(repo.links.create({ fromId: a.id, toId: a.id, toTitle: "Self" })).resolves.toBeTruthy();
  });
});

describe("search", () => {
  beforeEach(async () => {
    await repo.notes.create({ title: "Mental models", content: "Inversion, second-order thinking" });
    await repo.notes.create({ title: "Running log", content: "ran 5k, the runners were fast" });
    await repo.notes.create({ title: "Thinking", content: "nothing about models" });
  });

  it("ranks title matches above content matches", async () => {
    const r = await repo.notes.search("models");
    expect(r.map((n) => n.title)).toEqual(["Mental models", "Thinking"]);
  });

  it("stems and prefix-matches the last token", async () => {
    expect((await repo.notes.search("runner")).map((n) => n.title)).toEqual(["Running log"]);
    expect((await repo.notes.search("Men")).map((n) => n.title)).toEqual(["Mental models"]);
  });

  it.each([
    `"`, `'`, "(", ")", "*", "-", "a:b", "NEAR(", "AND", "OR NOT", "^", "{x}", "models\"", "' or 1=1 --",
  ])("never throws on %j", async (q) => {
    await expect(repo.notes.search(q)).resolves.toBeInstanceOf(Array);
  });

  it("empty or symbol-only query returns []", async () => {
    expect(await repo.notes.search("   ")).toEqual([]);
    expect(await repo.notes.search("!!!")).toEqual([]);
  });

  it("toFtsQuery quotes tokens and prefixes the last", () => {
    expect(toFtsQuery(`foo "bar" NEAR`)).toBe(`"foo" "bar" "NEAR"*`);
    expect(toFtsQuery("")).toBeNull();
  });

  it("finds a note after it is edited", async () => {
    const n = await repo.notes.getByTitle("Thinking");
    await repo.notes.update({ id: n!.id, title: "Thinking", content: "zettelkasten", themeId: null });
    expect((await repo.notes.search("zettelkasten")).map((x) => x.id)).toEqual([n!.id]);
  });
});

describe("round-trip budgets", () => {
  it("every method stays within its documented budget", async () => {
    const th = await repo.themes.create({ name: "T" });
    const a = await repo.notes.create({ title: "A" });
    const b = await repo.notes.create({ title: "B" });
    const l = await repo.links.create({ fromId: a.id, toId: b.id, toTitle: "B" });

    const budgets: [string, number, () => Promise<unknown>][] = [
      ["notes.list", 1, () => repo.notes.list({ limit: 50 })],
      ["notes.create", 1, () => repo.notes.create({ title: "C" })],
      ["notes.update", 1, () => repo.notes.update({ id: a.id, title: "A", content: "x", themeId: th.id })],
      ["notes.getById", 1, () => repo.notes.getById(a.id)],
      ["notes.getByTitle", 1, () => repo.notes.getByTitle("A")],
      ["notes.byTheme", 1, () => repo.notes.byTheme(th.id)],
      ["notes.assignTheme", 1, () => repo.notes.assignTheme({ noteId: a.id, themeId: th.id })],
      ["notes.search", 1, () => repo.notes.search("A")],
      ["links.create", 2, () => repo.links.create({ fromId: b.id, toId: a.id, toTitle: "A" })],
      ["links.getLinked", 1, () => repo.links.getLinked(a.id)],
      ["links.getBacklinks", 1, () => repo.links.getBacklinks(b.id)],
      ["links.delete", 1, () => repo.links.delete(l.id)],
      ["themes.create", 1, () => repo.themes.create({ name: "T2" })],
      ["themes.list", 1, () => repo.themes.list()],
      ["themes.getById", 1, () => repo.themes.getById(th.id)],
      ["themes.notesForSummary", 1, () => repo.themes.notesForSummary(th.id)],
      ["themes.setSynopsis", 1, () => repo.themes.setSynopsis({ themeId: th.id, synopsis: "s", model: "m" })],
      ["notes.delete", 1, () => repo.notes.delete(b.id)],
    ];
    for (const [name, budget, fn] of budgets) {
      expect({ name, trips: await t.roundTrips(fn) }).toEqual({ name, trips: budget });
    }
  });
});
