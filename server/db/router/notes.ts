import { router, publicProcedure } from "../../trpc";
import { z } from "zod";
import { notes } from "../schema";
import { randomUUID } from "crypto";

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
});