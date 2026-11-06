import { describe, it, expect, beforeEach } from "vitest";
import { forUser, type Repo } from "./repo";
import { testDb, twoUsers, type TestDb } from "../test/helpers";

/**
 * Every repo method called as user B against user A's data must behave as if
 * A's rows do not exist, and must leave A's rows untouched.
 */

type Fixture = {
  t: TestDb;
  repoA: Repo;
  repoB: Repo;
  a: { n1: string; n2: string; theme: string; link: string; title: string };
  bNote: string;
};

async function setup(): Promise<Fixture> {
  const t = await testDb();
  const { repoA, repoB } = await twoUsers(t);
  const theme = await repoA.themes.create({ name: "A theme" });
  const n1 = await repoA.notes.create({ title: "Alpha secret", content: "zebra plans" });
  const n2 = await repoA.notes.create({ title: "Alpha two" });
  await repoA.notes.assignTheme({ noteId: n1.id, themeId: theme.id });
  await repoA.themes.setSynopsis({ themeId: theme.id, synopsis: "A synopsis", model: "m" });
  const link = await repoA.links.create({ fromId: n1.id, toId: n2.id, toTitle: n2.title });
  const bNote = await repoB.notes.create({ title: "B note" });
  return {
    t,
    repoA,
    repoB,
    a: { n1: n1.id, n2: n2.id, theme: theme.id, link: link.id, title: n1.title },
    bNote: bNote.id,
  };
}

async function snapshotA(f: Fixture) {
  const q = async (sql: string) => (await f.t.raw.execute(sql)).rows.map((r) => ({ ...r }));
  return {
    notes: await q("select n.* from notes n join users u on u.id = n.user_id where u.email = 'a@example.com' order by rid"),
    themes: await q("select t.* from themes t join users u on u.id = t.user_id where u.email = 'a@example.com' order by id"),
    links: await q("select l.* from links l join users u on u.id = l.user_id where u.email = 'a@example.com' order by id"),
  };
}

const notFound = { code: "NOT_FOUND" };

const cases: Record<string, (f: Fixture) => Promise<void>> = {
  "notes.list": async ({ repoB, a }) => {
    const { items } = await repoB.notes.list({ limit: 50 });
    expect(items.map((n) => n.id)).not.toContain(a.n1);
  },
  "notes.create": async ({ repoB, a }) => {
    // Same title as A's note is fine for B: titles are unique per user only.
    await expect(repoB.notes.create({ title: a.title })).resolves.toBeTruthy();
  },
  "notes.update": async ({ repoB, a, bNote }) => {
    await expect(
      repoB.notes.update({ id: a.n1, title: "pwned", content: "", themeId: null }),
    ).rejects.toMatchObject(notFound);
    await expect(
      repoB.notes.update({ id: bNote, title: "B note", content: "", themeId: a.theme }),
    ).rejects.toMatchObject(notFound);
  },
  "notes.delete": async ({ repoB, a }) => {
    await expect(repoB.notes.delete(a.n1)).rejects.toMatchObject(notFound);
    await expect(repoB.notes.delete(a.n2)).rejects.toMatchObject(notFound);
  },
  "notes.getById": async ({ repoB, a }) => {
    expect(await repoB.notes.getById(a.n1)).toBeNull();
  },
  "notes.getByTitle": async ({ repoB, a }) => {
    expect(await repoB.notes.getByTitle(a.title)).toBeNull();
  },
  "notes.byTheme": async ({ repoB, a }) => {
    expect(await repoB.notes.byTheme(a.theme)).toEqual([]);
  },
  "notes.assignTheme": async ({ repoB, a, bNote }) => {
    await expect(repoB.notes.assignTheme({ noteId: a.n1, themeId: null })).rejects.toMatchObject(notFound);
    await expect(repoB.notes.assignTheme({ noteId: bNote, themeId: a.theme })).rejects.toMatchObject(notFound);
  },
  "notes.search": async ({ repoB }) => {
    expect(await repoB.notes.search("zebra")).toEqual([]);
    expect(await repoB.notes.search("Alpha")).toEqual([]);
  },
  "links.create": async ({ repoB, a, bNote }) => {
    await expect(
      repoB.links.create({ fromId: bNote, toId: a.n1, toTitle: "x" }),
    ).rejects.toMatchObject(notFound);
    await expect(
      repoB.links.create({ fromId: a.n1, toId: bNote, toTitle: "x" }),
    ).rejects.toMatchObject(notFound);
  },
  "links.delete": async ({ repoB, a }) => {
    await expect(repoB.links.delete(a.link)).rejects.toMatchObject(notFound);
  },
  "links.getLinked": async ({ repoB, a }) => {
    expect(await repoB.links.getLinked(a.n1)).toEqual([]);
  },
  "links.getBacklinks": async ({ repoB, a }) => {
    expect(await repoB.links.getBacklinks(a.n2)).toEqual([]);
  },
  "themes.create": async ({ repoB }) => {
    await expect(repoB.themes.create({ name: "A theme" })).resolves.toBeTruthy();
  },
  "themes.list": async ({ repoB, a }) => {
    expect((await repoB.themes.list()).map((t) => t.id)).not.toContain(a.theme);
  },
  "themes.getById": async ({ repoB, a }) => {
    expect(await repoB.themes.getById(a.theme)).toBeNull();
  },
  "themes.notesForSummary": async ({ repoB, a }) => {
    await expect(repoB.themes.notesForSummary(a.theme)).rejects.toMatchObject(notFound);
  },
  "themes.setSynopsis": async ({ repoB, a }) => {
    await expect(
      repoB.themes.setSynopsis({ themeId: a.theme, synopsis: "pwned", model: "x" }),
    ).rejects.toMatchObject(notFound);
  },
};

function repoMethodNames(repo: Repo): string[] {
  return Object.entries(repo).flatMap(([group, methods]) =>
    Object.keys(methods).map((m) => `${group}.${m}`),
  );
}

describe("isolation registry", () => {
  it("covers every repo method", async () => {
    const t = await testDb();
    const names = repoMethodNames(forUser(t.db, "x"));
    expect(names.filter((n) => !(n in cases))).toEqual([]);
    expect(Object.keys(cases).filter((n) => !names.includes(n))).toEqual([]);
  });
});

describe("user B cannot see or touch user A's data", () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await setup();
  });

  for (const [name, run] of Object.entries(cases)) {
    it(name, async () => {
      const before = await snapshotA(f);
      await run(f);
      expect(await snapshotA(f)).toEqual(before);
    });
  }
});
