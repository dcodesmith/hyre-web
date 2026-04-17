/**
 * Canonical form for pickup time strings from URLs, forms, and APIs.
 * Collapses NBSP/whitespace and casing so client, loaders, and server parse consistently.
 */
export function normalizePickupTimeParam(value: string | null | undefined): string {
  return (value ?? "")
    .replaceAll("\u00a0", " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
