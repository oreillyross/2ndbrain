import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { router, publicProcedure } from "../../trpc";
import { db } from "../";
import { users, magicTokens, sessions } from "../schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "../../services/email";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    return ctx.user;
  }),
  sendMagicLink: publicProcedure
    .input(z.object({ email: z.email("Invalid Email") }))
    .mutation(async ({ input, ctx }) => {
      const { email } = input;

      // 1. generate token
      const token = crypto.randomUUID();

      // 2. store in DB (you already have sessions table idea)
      await ctx.db.insert(magicTokens).values({
        email,
        token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 15),
      });

      // 3. build link
      const url = `${process.env.APP_URL}/auth/callback?token=${token}`;

      // 4. send email
      await sendEmail({
        to: email,
        subject: "Your login link",
        html: `
        <p>Click below to sign in:</p>
        <a href="${url}">Sign in</a>
      `,
      });

      return { success: true };
    }),
  testEmail: publicProcedure.mutation(async () => {
    await sendEmail({
      to: "oreillyross@gmail.com",
      subject: "Test email",
      html: "<p>It works 🚀</p>",
    });

    return { ok: true };
  }),

  verifyMagicLink: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // 1. find token
      const record = await db.query.magicTokens.findFirst({
        where: eq(magicTokens.token, input.token),
      });
      console.log("RECORD IS:", record, "TOKEN IS:", input.token);

      if (!record || record.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired token",
        });
      }

      // 2. find or create user
      let user = await db.query.users.findFirst({
        where: eq(users.email, record.email),
      });
      console.log("user", user);
      if (!user) {
        const [newUser] = await db
          .insert(users)
          .values({ email: record.email })
          .returning();

        user = newUser;
      }

      // 3. 🔥 DELETE token (one-time use)
      await db.delete(magicTokens).where(eq(magicTokens.token, input.token));

      // 4. 🔐 create session
      const sessionToken = randomBytes(32).toString("hex");

      await db.insert(sessions).values({
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      ctx.res.cookie("session", sessionToken, {
        httpOnly: true,
        sameSite: "none",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7,
        path: "/",
      });

      return { success: true };
    }),
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.cookie("session", "", {
      httpOnly: true,
      sameSite: "none",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0, // 👈 this deletes it
      path: "/",
    });

    return { success: true };
  }),
});
