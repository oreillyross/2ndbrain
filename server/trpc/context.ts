import type { Repo } from "../db/repo";
import type { Summariser } from "../ai";

/**
 * What procedures see. Deliberately no raw db: data access goes through the
 * owner-scoped `repo` only.
 */
export type Context = {
  user: { id: string; email: string } | null;
  repo: Repo | null;
  ai: Summariser;
};
