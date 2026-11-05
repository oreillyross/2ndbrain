import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { z } from "zod";
import { links, notes, themes } from "../schema";

import { sql, eq, and } from "drizzle-orm";
import type { Context } from "../../context";

// Throws NOT_FOUND unless the theme exists and belongs to the user.
async function assertThemeOwned(
  db: Context["db"],
  userId: string,
  themeId: string,
) {
  const [theme] = await db
    .select({ id: themes.id })
    .from(themes)
    .where(and(eq(themes.id, themeId), eq(themes.userId, userId)))
    .limit(1);
  if (!theme) throw new TRPCError({ code: "NOT_FOUND" });
}

export const notesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db.query.notes.findMany({
        where: eq(notes.userId, ctx.user.id),
      });
    } catch (err) {
      console.error("notesRouter.list", err);
      throw err;
    }
  }),

  create: protectedProcedure
    .input(z.object({ title: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // 1. create note
      try {
        const [note] = await ctx.db
          .insert(notes)
          .values({ title: input.title, userId: ctx.user.id })
          .returning();

        return note;
      } catch (err) {
        console.log("notes.create", err);
        throw err;
      }
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        title: z.string(),
        content: z.string(),
        themeId: z.string().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.themeId) {
        await assertThemeOwned(ctx.db, ctx.user.id, input.themeId);
      }

      const [updated] = await ctx.db
        .update(notes)
        .set({
          title: input.title,
          content: input.content,
          updatedAt: new Date(),
          themeId: input.themeId ?? null,
        })
        .where(and(eq(notes.id, input.id), eq(notes.userId, ctx.user.id)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      const query = input.query.trim();
      if (!query) return [];

      return ctx.db
        .select()
        .from(notes)
        .where(
          sql`
        ${notes.userId} = ${ctx.user.id}
        AND search_vector @@ plainto_tsquery('english', ${query})
      `,
        )
        .orderBy(
          sql`ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC`,
        )
        .limit(20);
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db
        .select()
        .from(notes)
        .where(
          sql`
        ${notes.id} = ${input.id}
        AND ${notes.userId} = ${ctx.user.id}
      `,
        )
        .limit(1);

      return result[0] ?? null;
    }),
  getByTitle: protectedProcedure
    .input(z.object({ title: z.string() }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db
        .select()
        .from(notes)
        .where(
          sql`
        ${notes.title} = ${input.title}
        AND ${notes.userId} = ${ctx.user.id}
      `,
        )
        .limit(1);

      return result[0] ?? null;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [deleted] = await ctx.db
        .delete(notes)
        .where(and(eq(notes.id, input.id), eq(notes.userId, ctx.user.id)))
        .returning({ id: notes.id });

      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });

      // No FK on links yet: remove outgoing links and unresolve incoming ones
      // so no orphan rows point at a deleted note.
      await ctx.db.delete(links).where(eq(links.fromNoteId, deleted.id));
      await ctx.db
        .update(links)
        .set({ toNoteId: null })
        .where(eq(links.toNoteId, deleted.id));

      return { success: true };
    }),

  backlinks: protectedProcedure
    .input(z.object({ noteId: z.uuid() }))
    .query(async ({ input, ctx }) => {
      // Owner scoping goes through the source note: only links written from
      // the user's own notes are returned.
      return ctx.db
        .select({
          id: links.id,
          fromNoteId: links.fromNoteId,
          toNoteId: links.toNoteId,
          toTitle: links.toTitle,
        })
        .from(links)
        .innerJoin(notes, eq(links.fromNoteId, notes.id))
        .where(
          and(eq(links.toNoteId, input.noteId), eq(notes.userId, ctx.user.id)),
        );
    }),
  assignTheme: protectedProcedure
    .input(
      z.object({
        noteId: z.uuid(),
        themeId: z.uuid().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.themeId) {
        await assertThemeOwned(ctx.db, ctx.user.id, input.themeId);
      }

      const [note] = await ctx.db
        .update(notes)
        .set({ themeId: input.themeId })
        .where(and(eq(notes.id, input.noteId), eq(notes.userId, ctx.user.id)))
        .returning();

      if (!note) throw new TRPCError({ code: "NOT_FOUND" });
      return note;
    }),
  byTheme: protectedProcedure
    .input(z.object({ themeId: z.uuid() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.query.notes.findMany({
        where: and(
          eq(notes.themeId, input.themeId),
          eq(notes.userId, ctx.user.id),
        ),
        orderBy: (notes, { desc }) => desc(notes.updatedAt),
      });
    }),
});
