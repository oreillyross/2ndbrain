import { router } from "./trpc";
import { notesRouter } from "../routers/notes";
import { healthRouter } from "../routers/health";

export const appRouter = router({
  notes: notesRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;