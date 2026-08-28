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

`CarDomain` reads types from `~/api/cars/schema`. `BookingDomain` reads types
from `~/api/bookings/schema`. Neither imports `*.server.ts`.

## Non-negotiable rules

1. Routes call `app/api/**/*.server.ts`. Components never do.
2. `schema.ts` = API response DTOs only. URL contracts are `*-url.ts`. Form
   schemas are `*-form-schema.ts`.
3. Public, fleet, and admin car schemas stay separate. Only public cars use
   `CarDomain(car)`.
4. `CarDomain` is display from DTO fields only — not availability, payable
   totals, or authorization. `BookingDomain` is the same for booking detail —
   not `canCancel` or pay authorization.
5. `app/review/` is customer reviews. Admin car approval lives in
   `app/admin/cars/` (`car-approval.ts`), not `ReviewCarDomain`.
6. Auth and payment transport stay under `app/api/`; protected web session
   cookies stay in their web capability folders (`app/auth/`, `app/payment/`).
7. No `index.ts` barrels in `app/api/` or capability folders.
8. `app/lib/` contains only `utils.ts` (`cn`). Gap folders are not created
   until the API endpoint, authorization, and DTO are verified.
9. Keep production source files at 400 lines or fewer. Prefer cohesive files
   in the 200–400 line range and split by responsibility before exceeding the
   limit. Test/spec files are exempt when splitting would reduce readability.

## Implemented now

```text
app/
  api/
    api.server.ts                 # fetch, timeout, abort, cookies
    api.server.test.ts
    problem-details.ts
    http-status.ts
    account/
      account.server.ts           # POST /api/account/delete
      schema.ts                   # deletion success response
    cars/
      cars.server.ts              # GET /api/cars/categories, GET /api/cars/search, GET /api/cars/:carId
                                  # listPublicSitemapCars pages unfiltered search
      schema.ts                   # PublicCar, SearchCar, PublicCarDetail, categories, search
    reviews/
      reviews.server.ts           # GET /api/reviews/car/:carId
      schema.ts                   # public review list + optional ratings
    referrals/
      referrals.server.ts         # GET /api/referrals/user
      schema.ts                   # signed-in summary, stats, referrals, rewards
    places/
      places.server.ts            # GET /api/places/autocomplete, POST /api/places/resolve
      schema.ts
    flights/
      flights.server.ts           # GET /api/search-flight, GET /api/calculate-trip-duration
      schema.ts
    ai-search/
      ai-search.server.ts         # POST /api/ai-search
      ai-search-form-schema.ts    # request query validation
      schema.ts                   # AI search response DTO
    auth/
      auth.server.ts              # role-scoped OTP send/verify, GET /auth/session, sign-out
      cookie-relay.server.ts      # copy every Set-Cookie; never join
      errors.ts                   # Better Auth 4xx / 429 / hide 403 role detail
      schema.ts                   # session + OTP DTOs
    fleet/
      cars/
        cars.server.ts            # GET list/detail; PATCH car; PUT rejected files
        schema.ts                 # fleet-owner car + file replacement response DTOs
      dashboard/
        dashboard.server.ts       # GET dashboard overview, earnings, payouts
        schema.ts                 # dashboard and payout response DTOs
    admin/
      cars/
        cars.server.ts            # admin car list/detail and review mutations
        schema.ts                 # admin car review transport DTOs
      documents/
        documents.server.ts       # guarded GET /api/proxy-pdf/:documentId stream
      rates/
        rates.server.ts           # admin rate read/create + add-on end mutations
        schema.ts                 # fee, VAT, and add-on rate transport DTOs
    bookings/
      bookings.server.ts          # GET list/detail; PATCH modify/cancel; POST preview + create
      schema.ts                   # list/detail DTOs; canEdit/canCancel; preview + create responses
    payments/
      payments.server.ts          # booking status, confirmation, expiration reconciliation
      schema.ts                   # booking payment lifecycle DTO
    users/
      users.server.ts             # GET|PATCH /api/users/me
      schema.ts                   # name, phone, city, address, marketingConsent

  car/
    car-domain.ts                 # public car display facts
    car-domain.test.ts
    paths.ts                      # /cars/:slug-fullCuid, category → /search?…
    paths.test.ts
    car-url.ts                    # booking query on /cars/:slug; reviewsPage for fetcher loads
    car-url.test.ts
    vehicle-card.tsx              # carousel + grid
    compact-star-rating.tsx
    car-detail-page.tsx
    car-gallery.tsx
    car-information.tsx
    car-booking-card.tsx          # URL booking interface; places/flight/duration
    car-booking-schedule-fields.tsx
    use-car-booking-card.ts       # date/address/flight handlers
    car-booking-pay-form.tsx      # Conform booking payload + guest fields
    car-booking-checkout.tsx      # cost breakdown + responsive Pay Now UI

  review/
    review-list.tsx
    review-sheet.tsx              # local-state dialog + same-page fetcher paging

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
    address-autocomplete.tsx
    booking-flight-field.tsx
    booking-location-fields.tsx
    airport-pickup.ts
    airport-pickup.test.ts
    trip-details.tsx              # airport pickup arrival / drive / drop-off
    airlines.json                 # Nigeria-serving airlines for flight suggestions
    airlines.ts
    airlines.test.ts
    bookings-url.ts               # /bookings?status= and Lagos list date copy
    bookings-url.test.ts
    bookings-list.tsx             # signed-in list rows link to /bookings/:id
    booking-create-form-schema.ts # car-card Conform/Zod; guest + booking fields
    booking-cost-breakdown.tsx    # API-owned segments, fees, discounts, VAT, total
    booking-guest-fields.tsx      # name / email / phone when unsigned-in
    booking-modify-form-schema.ts # pickup time/location update form → API PATCH DTO
    booking-modify.tsx            # API-gated responsive modification dialog
    booking-cancel-form-schema.ts # POST intent=cancel
    booking-cancel.tsx            # hireApp cancel card + Dialog confirm
    booking-domain.ts             # BookingDomain + Lagos timeline + payment rollup
    booking-domain.test.ts
    booking-detail-card.tsx       # shared detail layout
    booking-header.tsx
    booking-timeline.tsx
    booking-location-card.tsx
    booking-chauffeur-card.tsx
    booking-flight-card.tsx
    booking-payment-card.tsx
    booking-detail.tsx            # page composer + modify/cancel; no extend

  account/
    account-deletion.tsx          # confirmed destructive action + pending/error UI
    profile-form-schema.ts        # profile fields; marketingConsent checkbox
    profile-form.tsx              # Edit Profile page; email read-only

  referral/
    referral-page.tsx             # hireApp/mobile parity summary + copy/share UI
    share-referral-link.ts        # native Web Share with clipboard fallback
    use-copy-feedback.ts          # clipboard feedback timer + unmount cleanup

  search/
    search-url.ts                 # /search query contract + API serialization
    search-url.test.ts
    search-form.tsx               # GET /search, hero / compact / modal
    search-form-controls.tsx      # responsive date, flight, time + submit controls
    search-page.tsx
    search-filters.tsx
    search-heading.ts
    search-heading.test.ts
    compact-search-bar.tsx
    search-modal.tsx
    ai-search-modal.tsx           # home/search modal; same-origin POST /api/ai-search
    car-skeleton.tsx
    pagination-control.tsx        # sr-only SEO pagination

  home/
    home-page.tsx                 # hero collapse + mobile compact bar

  time/
    timezone.ts                   # Africa/Lagos
    timezone.test.ts

  auth/
    auth-layout.tsx               # viewport-centered login layout; logo top-left to home
    auth-form-primitives.tsx      # Uber-like inputs, checkbox, submit, errors
    auth-form-schema.ts           # email / OTP / admin role / pending cookie
    login-form.tsx                # shared customer/fleet/admin login UI; customer-only referral field
    referer.ts                    # APP_ORIGIN + role path; never caller URLs
    pending-otp.ts                # HttpOnly pending OTP cookie
    guest-only.server.ts          # signed-in /auth and /verify redirect
    fleet-owner-session.server.ts # fleet role redirect/403 guard over API session
    admin-context.server.ts       # request-scoped admin session + admin-only guard
    admin-session.server.ts       # admin/staff redirect/403 guard over API session
    session.server.ts             # API session user/roles; public header projection
    session.server.test.ts        # reads session.data.user from the API envelope
    verify-form.tsx               # shared customer/fleet OTP UI
    verify-otp.server.ts          # shared role-scoped OTP verify/resend action flow
    user.ts                       # header user shape + initials
    use-public-user.ts            # typed public-layout user access
    logout-navigation.ts          # pending logout form action
    user-nav.tsx                  # Register or Log in / initials dropdown: Profile, Bookings, Referrals, Log out
    user-nav.test.ts

  fleet/
    fleet-owner-sidebar.tsx       # responsive protected fleet navigation
    dashboard/
      dashboard.ts                # earnings bucket display
      dashboard-url.ts            # range filter and API grouping contract
      fleet-dashboard-page.tsx    # responsive overview and earnings activity
    cars/
      fleet-car.ts                # fleet car display labels
      fleet-car-status-badge.tsx  # shared fleet badge chrome; status and review tones
      fleet-cars-url.ts           # filter, sort, and pagination URL contract
      fleet-cars-filter.tsx       # desktop popover / mobile sheet filter content
      fleet-cars-table-columns.tsx
      fleet-cars-table.tsx        # sortable, filterable responsive owner inventory
      fleet-cars-list.tsx
      fleet-car-detail.tsx        # details + rejected image/document replacement
      fleet-car-file-replacement-form-schema.ts
      fleet-car-edit-form-schema.ts
      fleet-car-edit-form.tsx     # responsive pricing and availability form
    promotions/
      promotion.ts                # status and Lagos date display
      promotion-form-schema.ts    # create/deactivate web form contracts
      fleet-promotions-page.tsx   # responsive list, create sheet, deactivate action
    payouts/
      payout.ts                    # status labels and Lagos date display
      payouts-url.ts               # status filter and server pagination URL contract
      fleet-payouts-page.tsx       # responsive summary, cards/table, pagination

  admin/
    admin-sidebar.tsx              # responsive protected admin/staff navigation
    cars/
      admin-cars-url.ts            # approval-status filter + API pagination URL
      admin-cars-list.tsx          # responsive review queue
      admin-car-detail.tsx         # vehicle, owner, image, and document review
      admin-car-action-schema.ts   # review action form contract
      admin-car-asset-actions.tsx  # image/document approve/reject fetchers
      admin-car-review-badge.tsx
      car-approval.ts              # admin review labels/counts
    rates/
      rate-form-schema.ts          # fee, VAT, add-on, and end form contracts
      rate-window-fields.tsx       # shared UTC effective-window fields
      admin-fees-page.tsx          # responsive platform fee + VAT management
      admin-addon-rates-page.tsx   # responsive add-on create/history/end UI

  seo/
    metadata.ts
    metadata.test.ts
    structured-data.tsx
    robots.ts                     # production allow-list; preview/local Disallow: /
    robots.test.ts
    sitemap.ts                    # static locs + paged public search helpers
    sitemap.test.ts

  content/
    home.ts
    faq.ts
    legal.ts

  lib/
    utils.ts                      # cn() only

  money/
    currency.ts                   # shared ISO currency formatting
    currency.test.ts

  payment/
    payment-status-session.server.ts # encrypted HttpOnly callback credential

  hooks/
    use-hero-scroll.ts            # 100/50 hysteresis + matchMedia
    use-infinite-scroll.ts        # IntersectionObserver + fetcher
    use-search-filter-count.ts    # debounced countOnly fetcher
    use-place-autocomplete.ts     # debounced places fetcher + resolve
    use-airport-pickup.ts         # flight + trip-duration fetchers
    use-booking-pricing-preview.ts # API-owned payable pricing
    use-payment-status-polling.ts # bounded same-origin status polling
    use-element-height.ts         # ResizeObserver-backed fixed-bar clearance

  components/
    ui/                       # shadcn primitives; do not hand-edit
    forms/
      form-primitives.tsx     # neutral field errors and invalid state
    layout/
      brand-link.tsx          # shared Tripdly wordmark → /
    errors/
    legal/
    icons/
    cookie-consent-banner.tsx

  middleware/
  routes/
    robots.txt.ts                 # production Allow; preview/local Disallow
    sitemap.xml.ts                # static locs + paged public search cars
    _public.tsx                   # public layout; loads session for header/nav
    _auth.tsx                     # auth layout: no public header/footer
    auth.tsx                      # customer OTP request
    verify.tsx                    # customer OTP verify + resend
    logout.ts                     # POST sign-out; GET redirects home
    fleet-owner.login.tsx         # fleetOwner OTP request
    fleet-owner.verify.tsx        # fleetOwner OTP verify + resend
    fleet-owner.logout.ts         # role-scoped sign-out + local cookie cleanup
    fleet-owner.tsx               # protected fleet shell; API session role guard
    fleet-owner.dashboard.tsx     # static dashboard overview; skips range revalidation
    fleet-owner._index.tsx        # range-filtered dashboard earnings
    fleet-owner.cars.$carId.tsx   # owner car detail + rejected-file actions
    fleet-owner.cars.$carId.edit.tsx # owner-scoped car update
    fleet-owner.payout-transactions.tsx # payout list/summary; status filter + pagination
    admin.login.tsx               # admin/staff OTP request with explicit role
    admin.verify.tsx              # role-scoped admin/staff OTP verify + resend
    admin.logout.ts               # admin-scope sign-out + local cookie cleanup
    admin.tsx                     # protected responsive console shell + middleware
    admin._index.tsx              # API-free signed-in shell landing
    admin.cars.tsx                # server-paginated admin car review queue
    admin.cars.$carId.tsx         # car/image/document review actions
    admin.documents.$documentId.ts # same-origin private PDF stream
    admin.fees.tsx                # admin-only platform fee + VAT rate actions
    admin.addon-rates.tsx         # admin-only add-on create/end actions
    bookings.tsx                  # signed-in list; guests → /auth?redirectTo=
    bookings.$bookingId.tsx       # signed-in detail + cancel; guests → /auth?redirectTo=
    payment-status.tsx            # /bookings/payment-status callback + polling UI
    api.booking-pricing-preview.ts # same-origin pricing BFF
    api.account.delete.ts          # account deletion BFF + local auth-cookie cleanup
    profile.tsx                   # signed-in edit; guests → /auth?redirectTo=
    referrals.tsx                 # signed-in GET /api/referrals/user summary
```

## Next (do not create empty)

`GET /search` and `GET /cars/:carSlug` are live. The browser search URL uses
the same names as `GET /api/cars/search`: `bookingType`, `from`, `to`,
`pickupTime`, `flightNumber`, `q`, `vehicleType`, `serviceTier`, `make`,
`color`, `model`, `minPrice`, `maxPrice`, `minCapacity`, `fuelIncluded`,
`dealsOnly`, `page`, `limit`, and `countOnly`. Category pills still map names
to filters until
[`hyre-worker-nestjs#190`](https://github.com/dcodesmith/hyre-worker-nestjs/issues/190)
lands. Do not invent a second mapping.

Car detail keeps those booking and filter params and adds
`pickupAddress`, `dropOffAddress`, and `sameLocation`. Review sheet
open/close is local state. The browser URL stays on `/cars/:slug` with no
review query. Today, paging reuses the car loader via `reviewsPage` on the
fetcher request. Later PR: first paint still loads page 1 from the car
loader; later pages use a reviews-only fetcher to web
`GET /api/reviews/car/:carId?page=`, which calls only `getCarReviews`. Do
not page through the car loader once that route exists. The API endpoint
already exists.
Address params stay on `/cars/:slug` and are stripped from back-to-search.
They are not sent to `GET /api/cars/search`. Canonical slugs end with the
**full 25-character CUID** because `GET /api/cars/:carId` validates
`z.cuid()`. hireApp 13-character prefixes cannot be resolved without Prisma
in the Worker or a new API prefix lookup, so they 404 until the API adds
that. That is a cutover/SEO follow-up, not the preferred public URL shape.
See [03-ROUTE-API-READINESS.md](./03-ROUTE-API-READINESS.md#follow-ups-found-during-implementation).
Do not invent payable totals, availability, or review sub-rating aggregates
here.

- Review paging resource: `app/routes/api.reviews.car.$carId.ts` +
  `app/review/review-url.ts` — web `GET /api/reviews/car/:carId?page=`
  over existing `GET /api/reviews/car/:carId`. Keep the car URL clean.
- Booking modify / extend
- Guest booking lookup (`/bookings/lookup`) — API gap

## Later (verified API only)

- Extend `app/api/bookings/` and `app/api/payments/` only as new API endpoints
  are implemented.
- `app/api/fleet/{cars,dashboard,promotions,bookings}/` — dashboard calls
  `/api/dashboard/*`, not `/api/fleet-owner/dashboard`
- `app/api/admin/{rates,financial}/`
- grow `app/auth/` for admin login, `app/booking/`, `app/account/`
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
dashboard aggregate, guest booking lookup, or receipt PDF
until the API is verified.

## Current → target (homepage + search slices)

| Was | Now |
|---|---|
| `lib/api/*` | `api/` + `api/cars/{cars.server.ts, schema.ts}` |
| `lib/car-presentation.ts` | `car/car-domain.ts` + `car/paths.ts` |
| `lib/booking-types.ts` | `booking/types.ts` |
| `lib/booking-utils.ts` | `booking/dates.ts` + `booking/pickup.ts` |
| booking detail helpers in the page | `booking/booking-domain.ts` |
| `lib/timezone.ts` | `time/timezone.ts` |
| `lib/seo.ts` | `seo/metadata.ts` |
| `components/home/vehicle-card.tsx` | `car/vehicle-card.tsx` |
| `components/home/home-page.tsx` | `home/home-page.tsx` |
| `home/home-search.tsx` | `search/search-form.tsx` |
| `components/booking/*` | `booking/*` |
| `components/seo/*` | `seo/structured-data.tsx` |
| `constants/legal.ts` | `content/legal.ts` |
