import { db } from "./db";
import { users, sessions } from "./db/schema";
import { eq } from "drizzle-orm";

export async function createContext({ req, res }) {
  const cookie = req.headers.cookie ?? "";

  const sessionToken = cookie
    .split("; ")
    .find((c) => c.startsWith("session="))
    ?.split("=")[1];

  let user: { id: string; email: string } | null = null;

  if (sessionToken) {
    // 1. find session
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.token, sessionToken),
    });

    // 2. validate session
    if (session && session.expiresAt > new Date()) {
      // 3. fetch user
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, session.userId),
      });

      if (dbUser) {
        // 4. return safe user (recommended)
        user = {
          id: dbUser.id,
          email: dbUser.email,
        };
      }
    }
  }

  return { req, res, user, db };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
