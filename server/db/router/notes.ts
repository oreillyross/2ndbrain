import { router, publicProcedure } from "../../trpc";
import { z } from "zod";
import { links, notes } from "../schema";

import { sql, eq } from "drizzle-orm";

export const notesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db.select().from(notes);
    } catch (err) {
      console.error("notesRouter.list", err);
      throw err;
    }
  }),

  create: publicProcedure
    .input(z.object({ title: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // 1. create note
      try {
        const [note] = await ctx.db
          .insert(notes)
          .values({ title: input.title })
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
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [updated] = await ctx.db
        .update(notes)
        .set({
          title: input.title,
          content: input.content,
          updatedAt: new Date(),
        })
        .where(eq(notes.id, input.id))
        .returning();

      return updated;
    }),

  search: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!input.query.trim()) return [];

      return ctx.db
        .select()
        .from(notes)
        .where(sql`search_vector @@ plainto_tsquery('english', ${input.query})`)
        .orderBy(
          sql`ts_rank(search_vector, plainto_tsquery('english', ${input.query})) DESC`,
        )
        .limit(20);
    }),
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db
        .select()
        .from(notes)
        .where(eq(notes.id, input.id))
        .limit(1);

      return result[0] ?? null;
    }),
  getByTitle: publicProcedure
    .input(z.object({ title: z.string() }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db
        .select()
        .from(notes)
        .where(eq(notes.content, input.title)) // v1 assumption
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
});
