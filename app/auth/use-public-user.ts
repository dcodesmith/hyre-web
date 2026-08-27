import { useRouteLoaderData } from "react-router";

import type { loader as publicLoader } from "~/routes/_public";

/** Reads the signed-in user exposed by the public layout loader. */
export function usePublicUser() {
  return useRouteLoaderData<typeof publicLoader>("routes/_public")?.user ?? null;
}
