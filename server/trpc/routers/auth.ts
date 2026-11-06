import { router, publicProcedure } from "../init";

export const authRouter = router({
  /** The verified Access user, or null. Login/logout are handled by Cloudflare Access. */
  me: publicProcedure.query(({ ctx }) => ctx.user),
});
