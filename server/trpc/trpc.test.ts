import { describe, it, expect, beforeEach } from "vitest";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import { createClient, type Client } from "@libsql/client";
import { createApp, MAX_BATCH } from "../app";
import { applyMigrations } from "../db/migrate";
import { countingClient } from "../test/helpers";
import type { AppRouter } from "./router";
import type { Env } from "../env";
import type { Summariser } from "../ai";

const ORIGIN = "http://localhost:8787";
const env = (email = "me@example.com") =>
  ({ ENVIRONMENT: "development", DEV_EMAIL: email }) as Env;

let raw: Client;
let counting: ReturnType<typeof countingClient>;
let aiCalls: string[];
let aiImpl: Summariser["summarise"];

function client(email = "me@example.com", headers: Record<string, string> = { Origin: ORIGIN }) {
  const app = createApp({
    client: () => counting.client,
    ai: () => ({ model: "test-model", summarise: (t) => aiImpl(t) }),
  });
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${ORIGIN}/trpc`,
        transformer: superjson,
        headers,
        maxItems: MAX_BATCH,
        fetch: async (url, init) => app.request(String(url), init as RequestInit, env(email)),
      }),
    ],
  });
}

beforeEach(async () => {
  raw = createClient({ url: ":memory:" });
  await applyMigrations(raw);
  counting = countingClient(raw);
  aiCalls = [];
  aiImpl = async (t) => {
    aiCalls.push(t);
    return "a synopsis";
  };
});

const code = (e: unknown) => (e as TRPCClientError<AppRouter>).data?.code;

describe("tRPC over Hono", () => {
  it("auth.me returns the Access user, creating it on first request", async () => {
    const me = await client().auth.me.query();
    expect(me).toMatchObject({ email: "me@example.com" });
    expect(me?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await client().auth.me.query())?.id).toBe(me?.id);
  });

  it("notes round trip with Dates over superjson", async () => {
    const c = client();
    const n = await c.notes.create.mutate({ title: "Hello" });
    expect(n.createdAt).toBeInstanceOf(Date);
    await c.notes.update.mutate({ id: n.id, title: "Hello", content: "world", themeId: null });
    expect((await c.notes.getById.query({ id: n.id }))?.content).toBe("world");
    expect((await c.notes.search.query({ query: "world" })).map((x) => x.id)).toEqual([n.id]);
    const page = await c.notes.list.query();
    expect(page.items.map((x) => x.id)).toEqual([n.id]);
  });

  it("users are isolated end to end", async () => {
    const n = await client("a@example.com").notes.create.mutate({ title: "A's" });
    expect(await client("b@example.com").notes.getById.query({ id: n.id })).toBeNull();
    await expect(client("b@example.com").notes.delete.mutate({ id: n.id })).rejects.toSatisfy(
      (e) => code(e) === "NOT_FOUND",
    );
  });

  it("validates input", async () => {
    await expect(client().notes.getById.query({ id: "not-a-uuid" })).rejects.toSatisfy(
      (e) => code(e) === "BAD_REQUEST",
    );
    await expect(client().notes.create.mutate({ title: "   " })).rejects.toSatisfy(
      (e) => code(e) === "BAD_REQUEST",
    );
  });

  it("maps duplicate titles to CONFLICT", async () => {
    await client().notes.create.mutate({ title: "Dup" });
    await expect(client().notes.create.mutate({ title: "Dup" })).rejects.toSatisfy(
      (e) => code(e) === "CONFLICT",
    );
  });

  it("themes.summarise stores the AI synopsis", async () => {
    const c = client();
    const th = await c.themes.create.mutate({ name: "T" });
    const n = await c.notes.create.mutate({ title: "Idea", content: "body" });
    await c.notes.assignTheme.mutate({ noteId: n.id, themeId: th.id });
    const before = counting.counter.n;
    const updated = await c.themes.summarise.mutate({ themeId: th.id });
    expect(counting.counter.n - before).toBe(2); // notesForSummary (batch) + setSynopsis; user is cached
    expect(updated).toMatchObject({ synopsis: "a synopsis", synopsisModel: "test-model" });
    expect(aiCalls).toEqual(["Idea\nbody"]);
  });

  it("themes.summarise: empty theme is BAD_REQUEST, AI failure is BAD_GATEWAY", async () => {
    const c = client();
    const th = await c.themes.create.mutate({ name: "Empty" });
    await expect(c.themes.summarise.mutate({ themeId: th.id })).rejects.toSatisfy(
      (e) => code(e) === "BAD_REQUEST",
    );
    const n = await c.notes.create.mutate({ title: "x" });
    await c.notes.assignTheme.mutate({ noteId: n.id, themeId: th.id });
    aiImpl = async () => {
      throw new Error("sk-secret upstream detail");
    };
    const err = await c.themes.summarise.mutate({ themeId: th.id }).catch((e) => e);
    expect(code(err)).toBe("BAD_GATEWAY");
    expect(String(err.message)).not.toContain("sk-secret");
  });

  it("batches several procedures in one request", async () => {
    const c = client();
    const [a, b, me] = await Promise.all([
      c.notes.list.query(),
      c.themes.list.query(),
      c.auth.me.query(),
    ]);
    expect(a.items).toEqual([]);
    expect(b).toEqual([]);
    expect(me?.email).toBe("me@example.com");
  });
});

describe("transport guards", () => {
  const app = () => createApp({ client: () => raw });
  const post = (path: string, headers: Record<string, string>) =>
    app().request(
      `${ORIGIN}${path}`,
      { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ json: { title: "x" } }) },
      env(),
    );

  it("rejects writes without an Origin header", async () => {
    expect((await post("/trpc/notes.create", {})).status).toBe(403);
  });

  it("rejects writes from another origin", async () => {
    expect((await post("/trpc/notes.create", { Origin: "https://evil.example" })).status).toBe(403);
  });

  it("accepts same-origin writes", async () => {
    expect((await post("/trpc/notes.create", { Origin: ORIGIN })).status).toBe(200);
  });

  it(`rejects batches larger than ${MAX_BATCH}`, async () => {
    const paths = Array.from({ length: MAX_BATCH + 1 }, () => "auth.me").join(",");
    const res = await app().request(`${ORIGIN}/trpc/${paths}?batch=1&input={}`, {}, env());
    expect(res.status).toBe(413);
  });

  it("emits no CORS headers", async () => {
    const res = await app().request(`${ORIGIN}/trpc/auth.me`, { headers: { Origin: "https://evil.example" } }, env());
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
