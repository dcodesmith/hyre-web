# App structure

Agreed by Claude Opus 4.8, GPT 5.6, and Cursor Grok 4.6 Extra High Fast,
with locked product choices from the rebuild discussion.

This document is the live `app/` layout. [01-ARCHITECTURE.md](./01-ARCHITECTURE.md)
still owns BFF, cookie relay, caching, and the React effect policy. Names here
supersede the earlier `lib/api` sketch.

## Dependency flow

```text
route loader/action  →  app/api/{noun}/*.server.ts  →  api.server.ts  →  API
route component      →  app/{noun} | app/home | app/fleet | app/admin  →  components/ui
```

`CarDomain` reads types from `~/api/cars/schema`. It never imports `*.server.ts`.

## Non-negotiable rules

1. Routes call `app/api/**/*.server.ts`. Components never do.
2. `schema.ts` = API response DTOs only. URL contracts are `*-url.ts`. Form
   schemas are `*-form-schema.ts`.
3. Public, fleet, and admin car schemas stay separate. Only public cars use
   `CarDomain(car)`.
4. `CarDomain` is display from DTO fields only — not availability, payable
   totals, or authorization.
5. `app/review/` is customer reviews. Admin car approval lives in
   `app/admin/cars/` (`car-approval.ts`), not `ReviewCarDomain`.
6. Auth transport and the guest payment token stay under `app/api/`.
7. No `index.ts` barrels in `app/api/` or capability folders.
8. `app/lib/` contains only `utils.ts` (`cn`). Gap folders are not created
   until the API endpoint, authorization, and DTO are verified.

## Implemented now

```text
app/
  api/
    api.server.ts                 # fetch, timeout, abort, cookies
    api.server.test.ts
    problem-details.ts
    http-status.ts
    cars/
      cars.server.ts              # GET /api/cars/categories, GET /api/cars/search
      schema.ts                   # PublicCar, SearchCar, categories, search

  car/
    car-domain.ts                 # CarDomain(car, now, bookingType)
    car-domain.test.ts
    paths.ts                      # /cars/:slug-id, category → /search?…
    paths.test.ts
    vehicle-card.tsx              # carousel + grid
    compact-star-rating.tsx

  booking/
    types.ts                      # DAY | NIGHT | FULL_DAY | AIRPORT_PICKUP
    dates.ts
    dates.test.ts
    pickup.ts
    pickup.test.ts
    booking-type-tabs.tsx         # hero | modal | compact
    booking-type-input.tsx
    booking-time-select.tsx
    single-date-picker.tsx
    date-picker-triggers.tsx

  search/
    search-url.ts                 # /search query contract + API serialization
    search-url.test.ts
    search-form.tsx               # GET /search, hero / compact / modal
    search-page.tsx
    search-filters.tsx
    search-heading.ts
    search-heading.test.ts
    compact-search-bar.tsx
    search-modal.tsx
    car-skeleton.tsx
    pagination-control.tsx        # sr-only SEO pagination

  home/
    home-page.tsx                 # hero collapse + mobile compact bar

  time/
    timezone.ts                   # Africa/Lagos
    timezone.test.ts

  seo/
    metadata.ts
    metadata.test.ts
    structured-data.tsx

  content/
    home.ts
    faq.ts
    legal.ts

  lib/
    utils.ts                      # cn() only

  hooks/
    use-hero-scroll.ts            # 100/50 hysteresis + matchMedia
    use-infinite-scroll.ts        # IntersectionObserver + fetcher
    use-search-filter-count.ts    # debounced countOnly fetcher

  components/
    ui/
    layout/
    errors/
    legal/
    icons/
    cookie-consent-banner.tsx

  middleware/
  routes/
```

## Next (do not create empty)

`GET /search` is live. The browser URL uses the same names as
`GET /api/cars/search`: `bookingType`, `from`, `to`, `pickupTime`,
`flightNumber`, `q`, `vehicleType`, `serviceTier`, `make`, `color`, `model`,
`minPrice`, `maxPrice`, `minCapacity`, `fuelIncluded`, `dealsOnly`, `page`,
`limit`, and `countOnly`. Category pills still map names to filters until
[`hyre-worker-nestjs#190`](https://github.com/dcodesmith/hyre-worker-nestjs/issues/190)
lands. Do not invent a second mapping.

- Grow `app/api/cars` for public car detail
- `app/api/places/`, `app/api/rates/`, `app/api/reviews/`
- `app/review/` for the public review list
- AI search / places / flights (Phase 3 item 5)

## Later (verified API only)

- `app/api/auth/` — `auth.server.ts`, `cookie-relay.server.ts`, Better Auth errors
- `app/api/bookings/`, `app/api/payments/` including `guest-payment-token.server.ts`
- `app/api/fleet/{cars,dashboard,promotions,bookings}/` — dashboard calls
  `/api/dashboard/*`, not `/api/fleet-owner/dashboard`
- `app/api/admin/{cars,documents,rates,financial}/`
- `app/auth/`, grow `app/booking/`, `app/account/`
- `app/fleet/` and `app/admin/` consoles
- `app/components/console/`, `app/components/table/`

`app/api` is the BFF client layer, not hireApp `routes/api.*.ts`.

## Joint naming resolutions

| Topic | Decision |
|---|---|
| Client file | `app/api/api.server.ts` |
| Transport schemas | `schema.ts` per `app/api/{noun}/` folder |
| Search URL contract | `app/search/search-url.ts` |
| Fleet dashboard adapter | `app/api/fleet/dashboard/` → `/api/dashboard/*` |
| Admin car assembler | `app/admin/cars/car-approval.ts` |
| SEO / time | `app/seo/`, `app/time/` |
| Payment page | `app/booking/payment-status-page.tsx` |

## Gap policy

Gaps stay in [03-ROUTE-API-READINESS.md](./03-ROUTE-API-READINESS.md). Do not
scaffold partners, fleet chauffeurs, fleet booking list, admin owners, admin
dashboard aggregate, guest booking lookup, profile update, or receipt PDF
until the API is verified.

## Current → target (homepage + search slices)

| Was | Now |
|---|---|
| `lib/api/*` | `api/` + `api/cars/{cars.server.ts, schema.ts}` |
| `lib/car-presentation.ts` | `car/car-domain.ts` + `car/paths.ts` |
| `lib/booking-types.ts` | `booking/types.ts` |
| `lib/booking-utils.ts` | `booking/dates.ts` + `booking/pickup.ts` |
| `lib/timezone.ts` | `time/timezone.ts` |
| `lib/seo.ts` | `seo/metadata.ts` |
| `components/home/vehicle-card.tsx` | `car/vehicle-card.tsx` |
| `components/home/home-page.tsx` | `home/home-page.tsx` |
| `home/home-search.tsx` | `search/search-form.tsx` |
| `components/booking/*` | `booking/*` |
| `components/seo/*` | `seo/structured-data.tsx` |
| `constants/legal.ts` | `content/legal.ts` |
