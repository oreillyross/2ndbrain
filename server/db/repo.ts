import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { DB } from "./client";
import { links, notes, themes, users } from "./schema";

/**
 * Owner-scoped data access. Every method bakes in `user_id = ?`; routers get
 * only this object (`ctx.repo`), never the raw db. Another user's IDs behave
 * exactly like IDs that do not exist (NOT_FOUND / empty), so IDs can't be probed.
 *
 * Round-trip budget: every method makes at most 2 DB round trips (a `batch`
 * counts as one). `themes.summarise` composes up to 3 in its router.
 */

const notFound = () => new TRPCError({ code: "NOT_FOUND" });

// Columns returned to the client: never `rid` or `userId`.
const noteCols = {
  id: notes.id,
  title: notes.title,
  content: notes.content,
  themeId: notes.themeId,
  createdAt: notes.createdAt,
  updatedAt: notes.updatedAt,
};
const noteSummaryCols = {
  id: notes.id,
  title: notes.title,
  themeId: notes.themeId,
  createdAt: notes.createdAt,
  updatedAt: notes.updatedAt,
};
const themeCols = {
  id: themes.id,
  name: themes.name,
  description: themes.description,
  synopsis: themes.synopsis,
  synopsisUpdatedAt: themes.synopsisUpdatedAt,
  synopsisModel: themes.synopsisModel,
  createdAt: themes.createdAt,
};

function isUniqueViolation(err: unknown): boolean {
  const msg = String((err as { message?: unknown })?.message ?? err);
  const cause = String((err as { cause?: { message?: unknown } })?.cause?.message ?? "");
  return /UNIQUE constraint failed/i.test(msg + cause);
}

/** Opaque keyset cursor: "<updatedAtMs>.<rid>". */
function encodeCursor(updatedAt: Date, rid: number) {
  return `${updatedAt.getTime()}.${rid}`;
}
function decodeCursor(cursor: string): { ts: Date; rid: number } {
  const m = /^(\d+)\.(\d+)$/.exec(cursor);
  if (!m) throw new TRPCError({ code: "BAD_REQUEST", message: "bad cursor" });
  return { ts: new Date(Number(m[1])), rid: Number(m[2]) };
}

/**
 * Turn free text into a safe FTS5 query: each token is quoted (so `-`, `:`,
 * `"`, `*`, `NEAR`, `AND` etc. are literal) and the last one gets a prefix
 * wildcard for search-as-you-type. Returns null when there is nothing to match.
 */
export function toFtsQuery(input: string): string | null {
  const tokens = input
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(Boolean)
    .slice(0, 16);
  if (tokens.length === 0) return null;
  return tokens
    .map((t, i) => `"${t}"${i === tokens.length - 1 ? "*" : ""}`)
    .join(" ");
}

/** Find or create the user for a verified email. 1 round trip when the user exists, 2 on first login. */
export async function upsertUserByEmail(db: DB, email: string) {
  const [existing] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({ email })
    .onConflictDoUpdate({ target: users.email, set: { email } })
    .returning({ id: users.id, email: users.email });
  return created;
}

export function forUser(db: DB, userId: string) {
  const ownNote = (id: string) => and(eq(notes.id, id), eq(notes.userId, userId));
  const ownTheme = (id: string) => and(eq(themes.id, id), eq(themes.userId, userId));
  /** SQL guard: theme is null or owned by the user. */
  const themeOk = (themeId: string | null) =>
    themeId === null
      ? sql`1`
      : sql`exists (select 1 from ${themes} where ${themes.id} = ${themeId} and ${themes.userId} = ${userId})`;

  return {
    notes: {
      /** 1 RT. Newest first, without content. */
      async list(input: { cursor?: string | null; limit: number }) {
        const where = [eq(notes.userId, userId)];
        if (input.cursor) {
          const c = decodeCursor(input.cursor);
          where.push(
            or(
              lt(notes.updatedAt, c.ts),
              and(eq(notes.updatedAt, c.ts), lt(notes.rid, c.rid)),
            )!,
          );
        }
        const rows = await db
          .select({ ...noteSummaryCols, rid: notes.rid })
          .from(notes)
          .where(and(...where))
          .orderBy(desc(notes.updatedAt), desc(notes.rid))
          .limit(input.limit + 1);
        const page = rows.slice(0, input.limit);
        const last = page[page.length - 1];
        return {
          items: page.map(({ rid: _rid, ...n }) => n),
          nextCursor:
            rows.length > input.limit && last ? encodeCursor(last.updatedAt, last.rid) : null,
        };
      },

      /** 1 RT. CONFLICT if the user already has a note with this title. */
      async create(input: { title: string; content?: string }) {
        try {
          const [note] = await db
            .insert(notes)
            .values({ userId, title: input.title, content: input.content ?? "" })
            .returning(noteCols);
          return note;
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new TRPCError({ code: "CONFLICT", message: "A note with this title already exists" });
          }
          throw err;
        }
      },

      /** 1 RT. NOT_FOUND if the note or the theme is not the user's. */
      async update(input: { id: string; title: string; content: string; themeId: string | null }) {
        try {
          const [note] = await db
            .update(notes)
            .set({
              title: input.title,
              content: input.content,
              themeId: input.themeId,
              updatedAt: new Date(),
            })
            .where(and(ownNote(input.id), themeOk(input.themeId)))
            .returning(noteCols);
          if (!note) throw notFound();
          return note;
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new TRPCError({ code: "CONFLICT", message: "A note with this title already exists" });
          }
          throw err;
        }
      },

      /** 1 RT (batch). Removes outgoing links, unresolves incoming ones; does not rely on FK cascades. */
      async delete(id: string) {
        const [, , deleted] = await db.batch([
          db.delete(links).where(and(eq(links.userId, userId), eq(links.fromNoteId, id))),
          db
            .update(links)
            .set({ toNoteId: null })
            .where(and(eq(links.userId, userId), eq(links.toNoteId, id))),
          db.delete(notes).where(ownNote(id)).returning({ id: notes.id }),
        ]);
        if (deleted.length === 0) throw notFound();
        return { success: true as const };
      },

      /** 1 RT. */
      async getById(id: string) {
        const [note] = await db.select(noteCols).from(notes).where(ownNote(id)).limit(1);
        return note ?? null;
      },

      /** 1 RT. */
      async getByTitle(title: string) {
        const [note] = await db
          .select(noteCols)
          .from(notes)
          .where(and(eq(notes.userId, userId), eq(notes.title, title)))
          .limit(1);
        return note ?? null;
      },

      /** 1 RT. Notes in one of the user's themes, newest first. */
      async byTheme(themeId: string) {
        return db
          .select(noteCols)
          .from(notes)
          .where(and(eq(notes.userId, userId), eq(notes.themeId, themeId)))
          .orderBy(desc(notes.updatedAt))
          .limit(500);
      },

      /** 1 RT. NOT_FOUND if the note or the theme is not the user's. */
      async assignTheme(input: { noteId: string; themeId: string | null }) {
        const [note] = await db
          .update(notes)
          .set({ themeId: input.themeId })
          .where(and(ownNote(input.noteId), themeOk(input.themeId)))
          .returning(noteCols);
        if (!note) throw notFound();
        return note;
      },

      /** 1 RT. FTS5 over title + content, best match first. */
      async search(query: string, limit = 20) {
        const match = toFtsQuery(query);
        if (!match) return [];
        return db
          .select(noteCols)
          .from(sql`notes_fts`)
          .innerJoin(notes, sql`${notes.rid} = notes_fts.rowid`)
          .where(and(sql`notes_fts match ${match}`, eq(notes.userId, userId)))
          .orderBy(sql`bm25(notes_fts, 10.0, 1.0)`)
          .limit(limit);
      },
    },

    links: {
      /** 2 RT. Both notes must be the user's. */
      async create(input: { fromId: string; toId: string; toTitle: string }) {
        const ids = [...new Set([input.fromId, input.toId])];
        const owned = await db
          .select({ id: notes.id })
          .from(notes)
          .where(and(eq(notes.userId, userId), inArray(notes.id, ids)));
        if (owned.length !== ids.length) throw notFound();
        const [link] = await db
          .insert(links)
          .values({ userId, fromNoteId: input.fromId, toNoteId: input.toId, toTitle: input.toTitle })
          .returning({ id: links.id, fromNoteId: links.fromNoteId, toNoteId: links.toNoteId, toTitle: links.toTitle });
        return link;
      },

      /** 1 RT. */
      async delete(id: string) {
        const deleted = await db
          .delete(links)
          .where(and(eq(links.id, id), eq(links.userId, userId)))
          .returning({ id: links.id });
        if (deleted.length === 0) throw notFound();
        return { success: true as const };
      },

      /** 1 RT. Outgoing links of a note. */
      async getLinked(noteId: string) {
        return db
          .select({ id: links.id, toNoteId: links.toNoteId, toTitle: links.toTitle })
          .from(links)
          .where(and(eq(links.userId, userId), eq(links.fromNoteId, noteId)))
          .orderBy(asc(links.toTitle));
      },

      /** 1 RT. Incoming links of a note, with the source note's title. */
      async getBacklinks(noteId: string) {
        return db
          .select({ id: links.id, fromNoteId: links.fromNoteId, fromTitle: notes.title })
          .from(links)
          .innerJoin(notes, eq(notes.id, links.fromNoteId))
          .where(and(eq(links.userId, userId), eq(links.toNoteId, noteId), eq(notes.userId, userId)))
          .orderBy(asc(notes.title));
      },
    },

    themes: {
      /** 1 RT. */
      async create(input: { name: string; description?: string }) {
        const [theme] = await db
          .insert(themes)
          .values({ userId, name: input.name, description: input.description })
          .returning(themeCols);
        return theme;
      },

      /** 1 RT. With note counts. */
      async list() {
        return db
          .select({ ...themeCols, noteCount: count(notes.id) })
          .from(themes)
          .leftJoin(notes, and(eq(notes.themeId, themes.id), eq(notes.userId, userId)))
          .where(eq(themes.userId, userId))
          .groupBy(themes.id)
          .orderBy(asc(themes.name));
      },

      /** 1 RT. */
      async getById(id: string) {
        const [theme] = await db.select(themeCols).from(themes).where(ownTheme(id)).limit(1);
        return theme ?? null;
      },

      /** 1 RT. Title + content of a theme's notes for summarising; NOT_FOUND if the theme isn't the user's. */
      async notesForSummary(themeId: string) {
        const [theme, rows] = await db.batch([
          db.select({ id: themes.id }).from(themes).where(ownTheme(themeId)).limit(1),
          db
            .select({ title: notes.title, content: notes.content })
            .from(notes)
            .where(and(eq(notes.userId, userId), eq(notes.themeId, themeId)))
            .orderBy(desc(notes.updatedAt))
            .limit(200),
        ]);
        if (theme.length === 0) throw notFound();
        return rows;
      },

      /** 1 RT. */
      async setSynopsis(input: { themeId: string; synopsis: string; model: string }) {
        const [theme] = await db
          .update(themes)
          .set({ synopsis: input.synopsis, synopsisModel: input.model, synopsisUpdatedAt: new Date() })
          .where(ownTheme(input.themeId))
          .returning(themeCols);
        if (!theme) throw notFound();
        return theme;
      },
    },
  };
}

export type Repo = ReturnType<typeof forUser>;
