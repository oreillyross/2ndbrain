import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "./trpc";

export type { AppRouter };
type Out = inferRouterOutputs<AppRouter>;

export type Note = NonNullable<Out["notes"]["getById"]>;
export type NoteSummary = Out["notes"]["list"]["items"][number];
export type Theme = Out["themes"]["list"][number];
export type Link = Out["links"]["getLinked"][number];
export type Backlink = Out["links"]["getBacklinks"][number];
