import { router, publicProcedure } from "./init";
import { notesRouter } from "./routers/notes";
import { linksRouter } from "./routers/links";
import { themesRouter } from "./routers/themes";
import { authRouter } from "./routers/auth";

export const appRouter = router({
  health: router({
    ping: publicProcedure.query(() => ({ status: "ok" as const })),
  }),
  notes: notesRouter,
  links: linksRouter,
  themes: themesRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
