import { router, publicProcedure } from "../../trpc";
import { z } from "zod";
import { notes } from "../schema";
import { randomUUID } from "crypto";
import {sql, eq} from "drizzle-orm"

export const notesRouter = router({
  list: publicProcedure.query(async ({ctx}) => {
    try {
      
    return await ctx.db.select().from(notes);
    } catch (err) {
      console.error("notesRouter.list", err)
      throw err
    }
     
  }),

  create: publicProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const note = {
        id: randomUUID(),
        content: input.content,
      };

      await ctx.db.insert(notes).values(note);

      return note;
    }),
  search: publicProcedure
  .input(z.object({ query: z.string() }))
  .query(async ({ ctx, input }) => {
    if (!input.query.trim()) return [];

    return ctx.db
      .select()
      .from(notes)
      .where(
        sql`search_vector @@ plainto_tsquery('english', ${input.query})`
      )
      .orderBy(
        sql`ts_rank(search_vector, plainto_tsquery('english', ${input.query})) DESC`
      )
      .limit(20);
  }),
  delete: publicProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    await ctx.db.delete(notes).where(eq(notes.id, input.id));

    return { success: true };
  }),
});