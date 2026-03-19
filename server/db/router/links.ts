import { router, publicProcedure } from "../../trpc";
import {eq} from "drizzle-orm"
import { z } from "zod";
import { links, notes } from "../schema";

export const linksRouter = router({
  create: publicProcedure
    .input(
      z.object({
        fromId: z.string(),
        toId: z.string(),
        toTitle: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(links).values({
        fromNoteId: input.fromId,
        toNoteId: input.toId,
        toTitle: input.toTitle,
      });
    }),
  getLinked: publicProcedure
  .input(z.object({ noteId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .select()
      .from(links)
      .where(eq(links.fromNoteId, input.noteId));
  }),
  getBacklinks: publicProcedure
  .input(z.object({ noteId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        id: links.id,
        fromNoteId: links.fromNoteId,
        fromTitle: notes.title, // 👈 join to get title
      })
      .from(links)
      .leftJoin(notes, eq(links.fromNoteId, notes.id))
      .where(eq(links.toNoteId, input.noteId));
  }),
});
