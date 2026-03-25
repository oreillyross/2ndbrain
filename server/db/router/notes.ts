import { router, publicProcedure, protectedProcedure } from "../../trpc";
import { z } from "zod";
import { links, notes } from "../schema";

import { sql, eq } from "drizzle-orm";

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
  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string(),
        content: z.string(),
        themeId: z.string().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [updated] = await ctx.db
        .update(notes)
        .set({
          title: input.title,
          content: input.content,
          updatedAt: new Date(),
          themeId: input.themeId ?? null,
        })
        .where(eq(notes.id, input.id))
        .returning();

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
    .input(z.object({ id: z.string().uuid() }))
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
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.delete(notes).where(eq(notes.id, input.id));

      return { success: true };
    }),

  backlinks: publicProcedure
    .input(z.object({ noteId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return ctx.db
        .select()
        .from(links)
        .where(eq(links.toNoteId, input.noteId));
    }),
  assignTheme: protectedProcedure
    .input(
      z.object({
        noteId: z.string().uuid(),
        themeId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [note] = await ctx.db
        .update(notes)
        .set({ themeId: input.themeId })
        .where(eq(notes.id, input.noteId))
        .returning();

      return note;
    }),
  byTheme: publicProcedure
    .input(z.object({ themeId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.query.notes.findMany({
        where: (notes, { eq }) => eq(notes.themeId, input.themeId),
        orderBy: (notes, { desc }) => desc(notes.updatedAt),
      });
    }),
});
