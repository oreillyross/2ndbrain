import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTERS = new URL("./trpc/routers", import.meta.url).pathname;

/** Routers may only reach data through ctx.repo. */
const FORBIDDEN = [/from\s+["']drizzle-orm/, /from\s+["']@libsql/, /db\/schema/, /db\/client/, /db\/repo["']/];

describe("architecture", () => {
  const files = readdirSync(ROUTERS).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("finds the router files", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it.each(files)("%s does not import tables, the db client or drizzle", (f) => {
    const src = readFileSync(join(ROUTERS, f), "utf8");
    for (const re of FORBIDDEN) expect(src).not.toMatch(re);
  });

  it("the tRPC context exposes no raw db", () => {
    const src = readFileSync(new URL("./trpc/context.ts", import.meta.url).pathname, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bdb\s*:/);
  });
});
