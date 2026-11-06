import { z } from "zod";
import { router, protectedProcedure } from "../init";

const id = z.uuid();

export const linksRouter = router({
  create: protectedProcedure
    .input(z.object({ fromId: id, toId: id, toTitle: z.string().trim().min(1).max(500) }))
    .mutation(({ ctx, input }) => ctx.repo.links.create(input)),

  delete: protectedProcedure
    .input(z.object({ id }))
    .mutation(({ ctx, input }) => ctx.repo.links.delete(input.id)),

  getLinked: protectedProcedure
    .input(z.object({ noteId: id }))
    .query(({ ctx, input }) => ctx.repo.links.getLinked(input.noteId)),

  getBacklinks: protectedProcedure
    .input(z.object({ noteId: id }))
    .query(({ ctx, input }) => ctx.repo.links.getBacklinks(input.noteId)),
});
