import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "./schema";

/** Kept free of runtime/env imports: the web app type-checks through this via AppRouter. */
export type DB = LibSQLDatabase<typeof schema>;
