import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Client, InStatement } from "@libsql/client";
import { applyMigrations } from "../db/migrate";
import {
  FORMAT_VERSION,
  noteToMarkdown,
  parseNoteMarkdown,
  toIso,
  toIsoOrNull,
  toMs,
  toMsOrNull,
  type LinkRow,
  type NoteRow,
  type Snapshot,
  type ThemeRow,
  type UserRow,
} from "./format";

/**
 * Backup tooling. Node only (GitHub Actions / a laptop), never the Worker:
 * it reads every row, which would blow the free-plan CPU cap.
 * This is an admin tool and deliberately bypasses the owner-scoped repo.
 */

type Row = Record<string, unknown>;

/** Read the whole database in one read transaction (a consistent snapshot). */
export async function exportDb(client: Client): Promise<Snapshot> {
  const [u, t, n, l] = await client.batch(
    [
      "select id, email, created_at from users order by id",
      "select id, user_id, name, description, synopsis, synopsis_updated_at, synopsis_model, created_at from themes order by id",
      "select rid, id, user_id, title, content, theme_id, created_at, updated_at from notes order by id",
      "select id, user_id, from_note_id, to_note_id, to_title from links order by id",
    ],
    "read",
  );
  const rows = (r: { rows: unknown[] }) => r.rows as unknown as Row[];
  return {
    users: rows(u).map((r) => ({
      id: String(r.id),
      email: String(r.email),
      created_at: toIso(r.created_at),
    })),
    themes: rows(t).map((r) => ({
      id: String(r.id),
      user_id: String(r.user_id),
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      synopsis: (r.synopsis as string | null) ?? null,
      synopsis_updated_at: toIsoOrNull(r.synopsis_updated_at),
      synopsis_model: (r.synopsis_model as string | null) ?? null,
      created_at: toIso(r.created_at),
    })),
    notes: rows(n).map((r) => ({
      rid: Number(r.rid),
      id: String(r.id),
      user_id: String(r.user_id),
      title: String(r.title),
      content: String(r.content),
      theme_id: (r.theme_id as string | null) ?? null,
      created_at: toIso(r.created_at),
      updated_at: toIso(r.updated_at),
    })),
    links: rows(l).map((r) => ({
      id: String(r.id),
      user_id: String(r.user_id),
      from_note_id: String(r.from_note_id),
      to_note_id: (r.to_note_id as string | null) ?? null,
      to_title: String(r.to_title),
    })),
  };
}

const MANAGED = ["manifest.json", "users.json", "themes.json", "links.json"];
const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

/**
 * Write a snapshot into `dir`. Replaces only the files this tool owns
 * (`notes/` and the JSON files), so a backup repo's `.git` and README survive,
 * and notes deleted since the last run disappear from the backup.
 */
export function writeSnapshot(dir: string, s: Snapshot) {
  mkdirSync(dir, { recursive: true });
  rmSync(join(dir, "notes"), { recursive: true, force: true });
  mkdirSync(join(dir, "notes"));
  writeFileSync(join(dir, "manifest.json"), json({ format: FORMAT_VERSION }));
  writeFileSync(join(dir, "users.json"), json(s.users));
  writeFileSync(join(dir, "themes.json"), json(s.themes));
  writeFileSync(join(dir, "links.json"), json(s.links));
  for (const n of s.notes) writeFileSync(join(dir, "notes", `${n.id}.md`), noteToMarkdown(n));
}

export function readSnapshot(dir: string): Snapshot {
  for (const f of MANAGED) {
    if (!existsSync(join(dir, f))) throw new Error(`${dir} is not a snapshot: ${f} missing`);
  }
  const read = <T>(f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as T;
  const manifest = read<{ format: number }>("manifest.json");
  if (manifest.format !== FORMAT_VERSION) {
    throw new Error(`unsupported snapshot format ${manifest.format}`);
  }
  const notes = readdirSync(join(dir, "notes"))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => parseNoteMarkdown(readFileSync(join(dir, "notes", f), "utf8"), f));
  return {
    users: read<UserRow[]>("users.json"),
    themes: read<ThemeRow[]>("themes.json"),
    links: read<LinkRow[]>("links.json"),
    notes: notes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
}

const CHUNK = 200;

/**
 * Rebuild a database from a snapshot. Applies migrations first, refuses a
 * database that already has users, and inserts in FK order. The FTS index is
 * rebuilt by the insert triggers; `rid` is preserved so pagination cursors
 * and the FTS rowids match the source.
 */
export async function restoreDb(client: Client, s: Snapshot) {
  await applyMigrations(client);
  const existing = await client.execute("select count(*) as n from users");
  if (Number(existing.rows[0].n) > 0) {
    throw new Error("target database is not empty; restore only into a fresh database");
  }

  const stmts: InStatement[] = [
    ...s.users.map((r) => ({
      sql: "insert into users (id, email, created_at) values (?, ?, ?)",
      args: [r.id, r.email, toMs(r.created_at)],
    })),
    ...s.themes.map((r) => ({
      sql: "insert into themes (id, user_id, name, description, synopsis, synopsis_updated_at, synopsis_model, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        r.id,
        r.user_id,
        r.name,
        r.description,
        r.synopsis,
        toMsOrNull(r.synopsis_updated_at),
        r.synopsis_model,
        toMs(r.created_at),
      ],
    })),
    ...s.notes.map((r: NoteRow) => ({
      sql: "insert into notes (rid, id, user_id, title, content, theme_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [r.rid, r.id, r.user_id, r.title, r.content, r.theme_id, toMs(r.created_at), toMs(r.updated_at)],
    })),
    ...s.links.map((r) => ({
      sql: "insert into links (id, user_id, from_note_id, to_note_id, to_title) values (?, ?, ?, ?, ?)",
      args: [r.id, r.user_id, r.from_note_id, r.to_note_id, r.to_title],
    })),
  ];
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await client.batch(stmts.slice(i, i + CHUNK), "write");
  }
}

export type Counts = { users: number; themes: number; notes: number; links: number };
export const countsOf = (s: Snapshot): Counts => ({
  users: s.users.length,
  themes: s.themes.length,
  notes: s.notes.length,
  links: s.links.length,
});

/**
 * Restore drill: rebuild `scratch` from the snapshot in `dir`, export it again
 * and require the result to be identical to the snapshot (counts, every note
 * byte for byte, every link, so backlinks match too). Also checks the FTS
 * index is complete and consistent, so search returns what it did before.
 * Returns the counts; throws with the first difference otherwise.
 */
export async function verifySnapshot(dir: string, scratch: Client): Promise<Counts> {
  const original = readSnapshot(dir);
  await restoreDb(scratch, original);
  const again = await exportDb(scratch);

  const a = countsOf(original);
  const b = countsOf(again);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`count mismatch: snapshot ${JSON.stringify(a)}, restored ${JSON.stringify(b)}`);
  }
  for (const table of ["users", "themes", "links"] as const) {
    if (json(original[table]) !== json(again[table])) throw new Error(`${table} differ after restore`);
  }
  for (let i = 0; i < original.notes.length; i++) {
    if (noteToMarkdown(original.notes[i]) !== noteToMarkdown(again.notes[i])) {
      throw new Error(`note ${original.notes[i].id} differs after restore`);
    }
  }

  // Throws if the FTS index disagrees with the notes table.
  await scratch.execute("insert into notes_fts(notes_fts, rank) values ('integrity-check', 1)");
  // notes_fts reads through to `notes`; the docsize shadow table holds what was indexed.
  const fts = await scratch.execute("select count(*) as n from notes_fts_docsize");
  if (Number(fts.rows[0].n) !== a.notes) {
    throw new Error(`search index has ${fts.rows[0].n} rows, expected ${a.notes}`);
  }
  return a;
}
