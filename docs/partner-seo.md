# Partner SEO Notes

This document explains how partner landing pages are indexed and surfaced in search.

## Indexed URLs

- `/partners/:slug` is indexed and included in `sitemap.xml` for eligible partners.
- `/cars/:id` remains indexed for global inventory pages.
- `/partners/:slug/cars/:id` is crawlable to preserve context from partner flows.

## Non-indexed partner search URLs

- `/partners/:slug/search` is disallowed in `robots.txt`.
- This keeps search-result style pages out of index and avoids thin/duplicated entry pages.

## Partner sitemap eligibility

A partner is included in sitemap if all are true:

- `fleetOwnerStatus = APPROVED`
- `hasOnboarded = true`
- has at least one approved car in `AVAILABLE` or `BOOKED` status

Slug selection rules for sitemap:

- Use `username` when present.
- Fall back to a slugified `name` only when that derived slug is unique.
- Ambiguous fallback slugs are skipped.

## Metadata and structured data

Partner landing pages include:

- Canonical URL and descriptive title/description with partner name and city context.
- JSON-LD `Service` schema for chauffeur offering.
- JSON-LD `BreadcrumbList` schema for navigation context.
