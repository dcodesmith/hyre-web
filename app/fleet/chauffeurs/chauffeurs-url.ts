import { z } from "zod";

export const CHAUFFEUR_PAGE_SIZE = 20;

export function parseChauffeursPage(searchParams: URLSearchParams) {
  return z.coerce
    .number()
    .int()
    .positive()
    .catch(1)
    .parse(searchParams.get("page") ?? 1);
}

export function chauffeurPagePath(page: number) {
  return page > 1 ? `/fleet-owner/chauffeurs?page=${page}` : "/fleet-owner/chauffeurs";
}

export function toApiChauffeurSearchParams(page: number) {
  return new URLSearchParams({
    page: String(page),
    limit: String(CHAUFFEUR_PAGE_SIZE),
  });
}
