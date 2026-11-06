import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { testDb, twoUsers, type TestDb } from "../test/helpers";
import { forUser, upsertUserByEmail } from "../db/repo";
import { makeDb } from "../db/client";
import { exportDb, readSnapshot, restoreDb, verifySnapshot, writeSnapshot } from "./backup";
import { noteToMarkdown, parseNoteMarkdown, type NoteRow } from "./format";

const tricky = [
  "",
  "no trailing newline",
  "---\nlooks: like frontmatter\n---\nbody\n",
  "windows\r\nline endings\r\n",
  "unicode: café, 日本語, emoji 🧠, rtl שלום\n\n\n",
  "[[Link]] and `code` and <script>alert(1)</script>\n",
];

async function seed(t: TestDb) {
  const { a, b, repoA, repoB } = await twoUsers(t);
  const theme = await repoA.themes.create({ name: "Ideas", description: "half-baked" });
  await repoA.themes.setSynopsis({ themeId: theme.id, synopsis: "A synopsis.", model: "m" });
  await repoA.themes.create({ name: "Empty: \"quoted\"" });
  const notes = [];
  for (let i = 0; i < tricky.length; i++) {
    notes.push(await repoA.notes.create({ title: `Note ${i}: "x" --- y`, content: tricky[i] }));
  }
  await repoA.notes.assignTheme({ noteId: notes[1].id, themeId: theme.id });
  await repoA.links.create({ fromId: notes[0].id, toId: notes[1].id, toTitle: notes[1].title });
  await repoA.links.create({ fromId: notes[2].id, toId: notes[0].id, toTitle: notes[0].title });
  // Unresolved [[wikilink]].
  await t.raw.execute({
    sql: "insert into links (id, user_id, from_note_id, to_note_id, to_title) values ('l-unresolved', ?, ?, null, 'Missing')",
    args: [a.id, notes[3].id],
  });
  await repoB.notes.create({ title: "B's note", content: "searchable porcupine\n" });
  // Make sure rid gaps survive.
  const gone = await repoA.notes.create({ title: "deleted", content: "" });
  await repoA.notes.delete(gone.id);
  return { a, b, notes, theme };
}

function tmp() {
  return mkdtempSync(join(tmpdir(), "2b-backup-"));
}

async function scratch() {
  return createClient({ url: ":memory:" });
}

describe("note markdown format", () => {
  const base: NoteRow = {
    rid: 7,
    id: "n1",
    user_id: "u1",
    title: 'He said: "hi" ---',
    content: "",
    theme_id: null,
    created_at: "2026-01-02T03:04:05.678Z",
    updated_at: "2026-01-02T03:04:05.679Z",
  };

  it.each(tricky)("round-trips content %#", (content) => {
    const n = { ...base, content };
    expect(parseNoteMarkdown(noteToMarkdown(n))).toEqual(n);
  });

  it("is readable markdown with frontmatter", () => {
    expect(noteToMarkdown({ ...base, content: "Hello\n" })).toBe(
      [
        "---",
        'id: "n1"',
        "rid: 7",
        'user_id: "u1"',
        'title: "He said: \\"hi\\" ---"',
        "theme_id: null",
        'created_at: "2026-01-02T03:04:05.678Z"',
        'updated_at: "2026-01-02T03:04:05.679Z"',
        "---",
        "Hello",
        "",
      ].join("\n"),
    );
  });

  it("rejects broken files", () => {
    expect(() => parseNoteMarkdown("no frontmatter")).toThrow(/frontmatter/);
    expect(() => parseNoteMarkdown("---\r\nid: \"x\"\r\n---\r\n")).toThrow(/autocrlf/);
    expect(() => parseNoteMarkdown("---\nid: \"x\"\n")).toThrow(/unterminated/);
    expect(() => parseNoteMarkdown("---\nid: \"x\"\n---\n")).toThrow(/missing rid/);
  });
});

describe("backup export / restore", () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await testDb();
  });

  it("export → files → restore → export is lossless", async () => {
    await seed(t);
    const before = await exportDb(t.raw);
    const dir = tmp();
    writeSnapshot(dir, before);
    expect(readSnapshot(dir)).toEqual(before);

    const target = await scratch();
    await restoreDb(target, readSnapshot(dir));
    expect(await exportDb(target)).toEqual(before);
  });

  it("writes one .md per note and keeps unmanaged files", async () => {
    const { notes } = await seed(t);
    const dir = tmp();
    writeFileSync(join(dir, "README.md"), "mine\n");
    writeSnapshot(dir, await exportDb(t.raw));
    expect(readdirSync(join(dir, "notes"))).toHaveLength(notes.length + 1);
    expect(readFileSync(join(dir, "notes", `${notes[1].id}.md`), "utf8")).toMatch(
      /\n---\nno trailing newline$/,
    );
    expect(readFileSync(join(dir, "README.md"), "utf8")).toBe("mine\n");
    expect(readFileSync(join(dir, ".gitattributes"), "utf8")).toBe("* -text\n");
  });

  it("drops notes deleted since the last export", async () => {
    const { a, notes } = await seed(t);
    const dir = tmp();
    writeSnapshot(dir, await exportDb(t.raw));
    await forUser(t.db, a.id).notes.delete(notes[5].id);
    writeSnapshot(dir, await exportDb(t.raw));
    expect(readdirSync(join(dir, "notes"))).not.toContain(`${notes[5].id}.md`);
  });

  it("restored app data behaves the same: notes, backlinks, themes, search, isolation", async () => {
    const { a, b, notes, theme } = await seed(t);
    const dir = tmp();
    writeSnapshot(dir, await exportDb(t.raw));
    const target = await scratch();
    await restoreDb(target, readSnapshot(dir));
    const db2 = makeDb(target);

    const before = forUser(t.db, a.id);
    const after = forUser(db2, a.id);
    for (const n of notes) {
      expect(await after.notes.getById(n.id)).toEqual(await before.notes.getById(n.id));
      expect(await after.links.getBacklinks(n.id)).toEqual(await before.links.getBacklinks(n.id));
      expect(await after.links.getLinked(n.id)).toEqual(await before.links.getLinked(n.id));
    }
    expect(await after.notes.list({ limit: 100 })).toEqual(await before.notes.list({ limit: 100 }));
    expect(await after.themes.list()).toEqual(await before.themes.list());
    expect(await after.notes.byTheme(theme.id)).toEqual(await before.notes.byTheme(theme.id));
    for (const q of ["note", "café", "日本語", "frontmatter", "porcupine", "line endings", "-- \"x\""]) {
      expect(await after.notes.search(q)).toEqual(await before.notes.search(q));
    }
    expect(await forUser(db2, b.id).notes.search("porcupine")).toHaveLength(1);
    expect(await after.notes.search("porcupine")).toHaveLength(0);

    // The restored DB keeps working: new notes get fresh rids and are searchable.
    const fresh = await after.notes.create({ title: "after restore", content: "wombat" });
    expect((await after.notes.search("wombat")).map((n) => n.id)).toEqual([fresh.id]);
  });

  it("the first Access login on a restored DB finds the existing user", async () => {
    const { a } = await seed(t);
    const target = await scratch();
    await restoreDb(target, await exportDb(t.raw));
    const u = await upsertUserByEmail(makeDb(target), "a@example.com");
    expect(u.id).toBe(a.id);
  });

  it("refuses to restore over existing data", async () => {
    await seed(t);
    const snap = await exportDb(t.raw);
    await expect(restoreDb(t.raw, snap)).rejects.toThrow(/not empty/);
  });

  it("handles an empty database", async () => {
    const dir = tmp();
    writeSnapshot(dir, await exportDb(t.raw));
    expect(await verifySnapshot(dir, await scratch())).toEqual({ users: 0, themes: 0, notes: 0, links: 0 });
  });
});

describe("restore drill (verifySnapshot)", () => {
  it("passes on a good snapshot and reports counts", async () => {
    const t = await testDb();
    const { notes } = await seed(t);
    const dir = tmp();
    writeSnapshot(dir, await exportDb(t.raw));
    expect(await verifySnapshot(dir, await scratch())).toEqual({
      users: 2,
      themes: 2,
      notes: notes.length + 1,
      links: 3,
    });
  });

  it("fails on a snapshot that cannot be restored faithfully", async () => {
    const t = await testDb();
    await seed(t);
    const dir = tmp();
    writeSnapshot(dir, await exportDb(t.raw));
    // A link pointing at a note that is not in the backup.
    const links = JSON.parse(readFileSync(join(dir, "links.json"), "utf8"));
    links[0].to_note_id = "missing-note";
    writeFileSync(join(dir, "links.json"), JSON.stringify(links));
    await expect(verifySnapshot(dir, await scratch())).rejects.toThrow();
  });

  it("fails on an unknown format version", async () => {
    const t = await testDb();
    const dir = tmp();
    writeSnapshot(dir, await exportDb(t.raw));
    writeFileSync(join(dir, "manifest.json"), '{"format":99}');
    await expect(verifySnapshot(dir, await scratch())).rejects.toThrow(/format 99/);
  });
});
