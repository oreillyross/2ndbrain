import { router, publicProcedure } from "../../trpc";
import { z } from "zod";
import { links, notes } from "../schema";
import { extractLinks } from "../../lib/extractLinks";
import { sql, eq, ilike } from "drizzle-orm";

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
    .input(z.object({ content: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // 1. create note
      const [note] = await ctx.db
        .insert(notes)
        .values({ content: input.content })
        .returning();

      // 2. extract links
      const linkTitles = extractLinks(input.content);

      // 3. resolve links
      for (const title of linkTitles) {
        const existing = await ctx.db
          .select()
          .from(notes)
          .where(ilike(notes.content, `%${title}%`))
          .limit(1);

        await ctx.db.insert(links).values({
          fromNoteId: note.id,
          toNoteId: existing[0]?.id ?? null,
          toTitle: title,
        });
      }

      return note;
    }),
  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        content: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 1. update note
      await ctx.db
        .update(notes)
        .set({ content: input.content })
        .where(eq(notes.id, input.id));

      // 2. delete old links
      await ctx.db.delete(links).where(eq(links.fromNoteId, input.id));

      // 3. re-extract + insert
      const linkTitles = extractLinks(input.content);

      for (const title of linkTitles) {
        const existing = await ctx.db
          .select()
          .from(notes)
          .where(ilike(notes.content, `%${title}%`))
          .limit(1);

        await ctx.db.insert(links).values({
          fromNoteId: input.id,
          toNoteId: existing[0]?.id ?? null,
          toTitle: title,
        });
      }

      return { success: true };
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
  .query(async ({ input,ctx }) => {
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
