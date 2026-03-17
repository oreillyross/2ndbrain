import { router, publicProcedure } from "./trpc";

export const appRouter = router({
  health: router({
    ping: publicProcedure.query(() => {
      return { status: "ok" };
    }),
  }),
});

export type AppRouter = typeof appRouter;