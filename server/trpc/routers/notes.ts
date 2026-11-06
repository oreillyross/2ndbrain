import { z } from "zod";
import { router, protectedProcedure } from "../init";

const id = z.uuid();
const title = z.string().trim().min(1).max(500);
const content = z.string().max(200_000);

export const notesRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          cursor: z.string().max(64).nullish(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .default({ limit: 50 }),
    )
    .query(({ ctx, input }) => ctx.repo.notes.list(input)),

  create: protectedProcedure
    .input(z.object({ title, content: content.optional() }))
    .mutation(({ ctx, input }) => ctx.repo.notes.create(input)),

  update: protectedProcedure
    .input(z.object({ id, title, content, themeId: id.nullable() }))
    .mutation(({ ctx, input }) => ctx.repo.notes.update(input)),

  delete: protectedProcedure
    .input(z.object({ id }))
    .mutation(({ ctx, input }) => ctx.repo.notes.delete(input.id)),

  getById: protectedProcedure
    .input(z.object({ id }))
    .query(({ ctx, input }) => ctx.repo.notes.getById(input.id)),

  getByTitle: protectedProcedure
    .input(z.object({ title }))
    .query(({ ctx, input }) => ctx.repo.notes.getByTitle(input.title)),

  search: protectedProcedure
    .input(z.object({ query: z.string().max(200) }))
    .query(({ ctx, input }) => ctx.repo.notes.search(input.query)),

  byTheme: protectedProcedure
    .input(z.object({ themeId: id }))
    .query(({ ctx, input }) => ctx.repo.notes.byTheme(input.themeId)),

  assignTheme: protectedProcedure
    .input(z.object({ noteId: id, themeId: id.nullable() }))
    .mutation(({ ctx, input }) => ctx.repo.notes.assignTheme(input)),
});
