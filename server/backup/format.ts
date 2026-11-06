/**
 * Backup snapshot format (version 1). A snapshot is a directory:
 *
 *   manifest.json   { "format": 1 }
 *   users.json      rows sorted by id
 *   themes.json     rows sorted by id
 *   links.json      rows sorted by id
 *   notes/<id>.md   one file per note: frontmatter + content verbatim
 *
 * Frontmatter values are JSON (which is also valid YAML), so titles with
 * quotes, colons or `---` round-trip without a YAML dependency. Everything
 * after the closing `---` line is the note content, byte for byte.
 * Timestamps are ISO strings (ms precision, lossless for timestamp_ms).
 */

export const FORMAT_VERSION = 1;

export type UserRow = { id: string; email: string; created_at: string };
export type ThemeRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  synopsis: string | null;
  synopsis_updated_at: string | null;
  synopsis_model: string | null;
  created_at: string;
};
export type LinkRow = {
  id: string;
  user_id: string;
  from_note_id: string;
  to_note_id: string | null;
  to_title: string;
};
export type NoteRow = {
  rid: number;
  id: string;
  user_id: string;
  title: string;
  content: string;
  theme_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Snapshot = {
  users: UserRow[];
  themes: ThemeRow[];
  links: LinkRow[];
  notes: NoteRow[];
};

const NOTE_KEYS = ["id", "rid", "user_id", "title", "theme_id", "created_at", "updated_at"] as const;

export function noteToMarkdown(n: NoteRow): string {
  const fm = NOTE_KEYS.map((k) => `${k}: ${JSON.stringify(n[k])}`).join("\n");
  return `---\n${fm}\n---\n${n.content}`;
}

export function parseNoteMarkdown(text: string, source = "note"): NoteRow {
  if (!text.startsWith("---\n")) throw new Error(`${source}: missing frontmatter`);
  const end = text.indexOf("\n---\n", 3);
  if (end === -1) throw new Error(`${source}: unterminated frontmatter`);
  const fields: Record<string, unknown> = {};
  for (const line of text.slice(4, end).split("\n")) {
    const m = /^([a-z_]+): (.*)$/.exec(line);
    if (!m) throw new Error(`${source}: bad frontmatter line`);
    fields[m[1]] = JSON.parse(m[2]);
  }
  for (const k of NOTE_KEYS) {
    if (!(k in fields)) throw new Error(`${source}: missing ${k}`);
  }
  return {
    rid: fields.rid as number,
    id: fields.id as string,
    user_id: fields.user_id as string,
    title: fields.title as string,
    content: text.slice(end + 5),
    theme_id: fields.theme_id as string | null,
    created_at: fields.created_at as string,
    updated_at: fields.updated_at as string,
  };
}

export const toIso = (ms: unknown): string => new Date(Number(ms)).toISOString();
export const toIsoOrNull = (ms: unknown): string | null => (ms == null ? null : toIso(ms));
export const toMs = (iso: string): number => {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`bad timestamp: ${iso}`);
  return ms;
};
export const toMsOrNull = (iso: string | null): number | null => (iso == null ? null : toMs(iso));
