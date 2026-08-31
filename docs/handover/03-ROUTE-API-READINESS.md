# Route and API readiness

This inventory is a planning aid, not a generated API specification. It was derived from the API controller decorators and current mobile usage. Confirm DTOs, guards, query parameters, and response status codes before implementing each route.

No Swagger/OpenAPI generation was found in the API. Mobile currently maintains manual response types and casts. Until the API publishes a generated contract, route readiness must include explicit runtime transport validation for critical flows.

Backend coverage gaps in this document are framework-independent. Choosing TanStack Start would not remove or type missing API endpoints.

## Status meanings

- **Available**: a matching API controller endpoint was observed.
- **Verify**: a related endpoint exists, but parity with the legacy route is unproven.
- **Gap**: no matching controller endpoint was observed.
- **Web-owned**: belongs to React Router/Cloudflare rather than the API.
- **Remove/redirect**: duplicate legacy backend endpoint; the API should own it.

## Observed API surface

### Auth and account

- `ALL /api/auth/*` — Better Auth
- `GET /auth/session`
- `POST /api/account/delete`
- `POST|DELETE /api/users/me/push-tokens`

Better Auth response and error bodies bypass the API's normal Problem Details filter and require a separate web parser.

### Public cars, search, maps, and flights

- `GET /api/cars/categories`
- `GET /api/cars/search`
- `GET /api/cars/:carId`
- `GET /api/rates`
- `GET /api/places/autocomplete`
- `POST /api/places/resolve`
- `POST /api/places/validate`
- `GET /api/calculate-trip-duration`
- `GET /api/search-flight`
- `POST /api/ai-search`

### Bookings and payments

- `POST /api/bookings`
- `GET /api/bookings`
- `GET /api/bookings/payment-status`
- `GET /api/bookings/:bookingId`
- `PATCH /api/bookings/:bookingId`
- `PATCH /api/bookings/:bookingId/cancel`
- `POST /api/bookings/pricing-preview`
- `POST /api/bookings/guest-access`
- `GET /api/bookings/guest-access?token=...`
- `POST /api/bookings/:bookingId/extensions`
- provisional `GET|POST /api/bookings/:bookingId/airport-completion` using `X-Booking-Completion-Token`
- `POST /api/payments/initialize`
- `GET /api/payments/status/:txRef`
- `POST /api/payments/booking-confirmation`
- `POST /api/payments/extension-confirmation`
- `POST /api/payments/booking-expiration`
- `POST /api/payments/:txRef/refund`

### Reviews and referrals

- `POST /api/reviews/create`
- `GET /api/reviews/car/:carId`
- `GET /api/reviews/chauffeur/:chauffeurId`
- `GET /api/reviews/booking/:bookingId`
- `GET|PUT /api/reviews/:reviewId`
- `DELETE /api/reviews/:reviewId` — admin-only moderation/hide, not customer deletion
- `GET /api/referrals/validate/:code` — session required; unlike the legacy public route
- `GET /api/referrals/eligibility` — session required; current type schema excludes airport pickup
- `GET /api/referrals/user` — session required

### Fleet-owner and chauffeur

- `GET|POST /api/fleet-owner/cars`
- `GET|PATCH /api/fleet-owner/cars/:carId`
- `PUT /api/fleet-owner/cars/:carId/images/:imageId/file`
- `PUT /api/fleet-owner/cars/:carId/documents/:documentId/file`
- `PATCH /api/fleet-owner/bookings/:bookingId/chauffeur`
- `GET|POST /api/fleet-owner/promotions`
- `POST /api/fleet-owner/promotions/:promotionId/deactivate`
- `GET /api/dashboard/overview`
- `GET /api/dashboard/earnings`
- `GET /api/dashboard/payouts`
- `GET /api/dashboard/payouts/summary`
- `PATCH /api/fleet-owner/bookings/:bookingId/airport-completion`
- chauffeur airport-completion page endpoints under `/chauffeur/airport-trips`

### Admin

- `GET /api/admin/cars`
- `GET /api/admin/cars/:carId`
- `POST /api/admin/cars/:carId/approve`
- `PATCH /api/admin/cars/:carId/cover`
- image approve/reject under `/api/admin/cars/:carId/images`
- document approve/reject under `/api/admin/documents`
- admin rates under `/api/rates/admin`
- platform fee, VAT, add-on create/end under `/api/rates`
- refund/payout list, detail, and reconcile under `/api/admin/financial-operations`

### Backend-only integrations

- Flutterwave webhook under `/api/payments/webhook/flutterwave`
- Twilio webhook endpoints
- FlightAware webhook
- document proxy
- `GET /health` — not `/api/health`
- job/manual trigger endpoint

These should not be reimplemented in the Worker.

## Legacy web route readiness

### Public and SEO

**Available**

- `/search` -> car search, rates, places
- `/cars/:id` -> car detail and reviews. Canonical slugs use the full CUID
  because `GET /api/cars/:carId` is `z.cuid()`. hireApp 13-character prefixes
  404 until the API adds prefix lookup.
- `/chauffeur-service-lagos` -> web content plus public car/search data

**Gap unless an endpoint is added**

- `/partners/:slug`
- `/partners/:slug/search`
- `/partners/:slug/cars/:id`

No partner/slug controller was observed. Partner pages require partner identity, branding, attribution, scoped inventory, and canonical behavior.

**Verify**

- `/` fleet sections can be built from `GET /api/cars/categories`; the response already includes
  promotions, rating aggregates, and `createdAt` (see
  [`hyre-worker-nestjs#191`](https://github.com/dcodesmith/hyre-worker-nestjs/pull/191)), so the
  homepage does not need rates or separate review reads. Web treats `createdAt` as optional until
  that field is on every environment.
- Category navigation metadata remains a contract follow-up:
  [`hyre-worker-nestjs#190`](https://github.com/dcodesmith/hyre-worker-nestjs/issues/190).
  The API currently returns category names, titles, dimensions, and cars, but not the concrete
  multi-value filters accepted by `/api/cars/search`. Web and mobile must temporarily map names to
  filters; complete the issue before or with the public search slice to remove that duplication.

**Web-owned**

- `/about`
- `/faq`
- `/terms`
- `/privacy`
- `/cookies`
- `/robots.txt`
- `/sitemap.xml`
- catch-all 404
- API documentation/discovery pages if retained

### Authentication

**Available**

- customer OTP login/verify
- fleet-owner OTP login/verify
- admin OTP login/verify
- session lookup and logout

All roles use the API's Better Auth endpoints. Role-specific pages remain separate for UI parity, but authentication must not be reimplemented.

### Customer

**Available**

- `/bookings`
- `/bookings/lookup`
- `/bookings/guest` -> short-lived token exchange, then `/bookings/:id`
- `/profile` -> `GET|PATCH /api/users/me`
- `/bookings/:id`
- `/bookings/:id/extend`
- `/bookings/payment-status`
- `/referrals`
- review reads, create, and owner update
- account deletion

**Gap unless an endpoint is added**

- booking receipt PDF -> no dedicated booking receipt endpoint was observed
- review deletion -> observed DELETE is admin-only moderation

**Verify**

- every legacy booking mutation and cancellation policy
- referral attribution inputs during signup/booking
- referral validation public/signup behavior because the REST validation endpoint requires a session
- referral eligibility for airport-pickup bookings
- booking idempotency and guest `paymentStatusToken` persistence/header forwarding

### Fleet owner

**Implemented in hyre-web**

- fleet-owner OTP login/verify, session lookup, logout, and role enforcement
- `/fleet-owner/cars` using `GET /api/fleet-owner/cars`, with responsive
  faceted filters, sorting, column visibility, row actions, and pagination
- `/fleet-owner/cars/:carId` using `GET /api/fleet-owner/cars/:carId`
- rejected image/document replacement on `/fleet-owner/cars/:carId` using
  owner-scoped `PUT /api/fleet-owner/cars/:carId/{images|documents}/:assetId/file`
- `/fleet-owner/cars/:carId/edit` using owner-scoped
  `GET|PATCH /api/fleet-owner/cars/:carId`
- `/fleet-owner/promotions` using `GET|POST /api/fleet-owner/promotions` and
  `POST /api/fleet-owner/promotions/:promotionId/deactivate`
- `/fleet-owner/payout-transactions` using `GET /api/dashboard/payouts` and
  `GET /api/dashboard/payouts/summary`
- `/fleet-owner` overview, range-filtered earnings, and payout snapshot using
  `GET /api/dashboard/overview`, `GET /api/dashboard/earnings`, and
  `GET /api/dashboard/payouts/summary`; its Available, Booked, and Maintenance
  vehicle breakdown is derived from `GET /api/fleet-owner/cars`

**Available or closely matched**

- car create/upload
- booking chauffeur assignment
- airport-trip completion

**Verify**

- legacy dashboard extras still need owner-driver state, utilization, chauffeur
  availability, unassigned/recent bookings, and next payout contracts
- fleet booking detail through the generic booking endpoint requires ownership/field parity verification
- exact car onboarding/document workflow

**Gap unless another endpoint is discovered**

- fleet-owner onboarding completion
- session/profile fields for `hasOnboarded` and `isOwnerDriver`
- bank-account resolution and payout-details update
- `GET /api/fleet-owner/bookings` list/filter endpoint
- chauffeur list/create/detail/update
- fleet car deletion
- booking start/end dates on fleet-owner payout-list items
- any fleet-specific report not covered by dashboard endpoints

### Admin

**Implemented in hyre-web**

- `/admin/login`, `/admin/verify`, and `/admin/logout` through the role-scoped
  Better Auth BFF flow for `admin` and `staff`
- protected `/admin` responsive shell using `GET /auth/session` role data
- `/admin/cars` using the server-paginated `GET /api/admin/cars` review queue
- `/admin/cars/:carId` using `GET /api/admin/cars/:carId`, with API-owned car,
  image, and document approval actions plus admin-only cover/final approval;
  private document keys are viewed through the guarded API PDF proxy
- admin-only `/admin/fees` and `/admin/addon-rates` using
  `GET /api/rates/admin`, platform fee/VAT/add-on create endpoints, and the
  add-on end endpoint; overlapping windows remain API-owned conflicts

**Available or closely matched**

- refund and payout reconciliation actions

**Gap unless another endpoint is discovered**

- admin dashboard aggregate parity
- owner list/detail/update
- owner car/chauffeur management pages
- staff management
- reports
- admin review moderation/listing
- referral configuration
- referral attribution list/detail/manual attribution
- referral rewards
- pending document/image list for the admin documents page
- legacy booking reconciliation aggregate

Do not port the legacy Prisma-based admin loaders to Cloudflare to fill these gaps. Add guarded API controllers and contract tests.

The current API has no platform fee or VAT end/update mutation. The web can
create only non-overlapping windows and must surface `RATE_DATE_OVERLAP`
instead of copying the legacy database mutation behavior.

## Legacy resource/API route disposition

### Remove or replace with BFF calls

- local Better Auth catch-all
- AI search
- trip-duration calculation
- flight search
- reviews
- referrals
- account deletion
- payment status and mutations
- admin reconciliation
- document proxy

The UI may retain the same browser-visible route where required, but implementation must delegate to the API.

### Redirect/configure external providers to the API

- Flutterwave webhook
- Twilio webhooks
- FlightAware webhook

Verify provider dashboards and secrets before cutover.

### Remove from production

- test OTP;
- test booking details;
- test booking activation;
- test seed-car routes.

Equivalent test support belongs behind explicit API test infrastructure, never a production Worker route.

### Keep web-owned

- robots;
- sitemap;
- public API docs/catalog/OpenAPI resources when intentionally part of the website;
- markdown content negotiation for the website, if still required.

## Mobile reference coverage

Current mobile code demonstrates:

- central base URL and timeout;
- JSON parsing and typed `ApiError`;
- OTP request/verify/session/logout;
- bearer authentication;
- car categories/search/detail;
- rates;
- places;
- booking pricing/create/list/detail/actions;
- payment confirmation/expiration;
- referrals;
- reviews;
- flight search and trip duration;
- push tokens.

Reuse endpoint and payload knowledge. Do not copy:

- Expo environment discovery;
- secure-store bearer tokens;
- `X-Client-Type: mobile`;
- device-specific Origin handling;
- TanStack Query defaults without a web need;
- native navigation/cache invalidation behavior.

## Backend backlog gate

Before a migration phase starts, create one backend issue per missing capability containing:

- legacy web route and screenshot;
- required role;
- URL/search-parameter schema;
- request/query shape;
- expected and validated response DTO;
- BFF loader/action/server-function ownership;
- cookie or guest-token requirements;
- authenticated/public cache policy;
- Problem Details/error codes;
- authorization and ownership rules;
- pagination/filter/sort behavior;
- contract and e2e test acceptance criteria.

An endpoint is ready only when it exists in the API, is authorized, is tested, and is usable without importing Prisma types into the web app.

## Follow-ups found during implementation

Append here when a shipped slice works but a better contract or SEO shape is
blocked on the API. Do not invent the missing endpoint in the Worker.

### Profile update

`GET /profile` is a same-origin BFF over `GET|PATCH /api/users/me`
(`SessionGuard`). Guests redirect to `/auth?redirectTo=/profile`. The form
edits `name`, `phoneNumber`, `city`, `address`, and `marketingConsent`. Email
is read-only from `GET /auth/session`. This slice does not change email or call
Better Auth `update-user`.

### Account deletion

The profile danger zone submits to same-origin `POST /api/account/delete`,
which delegates to API `POST /api/account/delete` (`SessionGuard`). The API
anonymizes the customer's bookings and deletes the user in one transaction;
the user deletion cascades their API sessions. On success the BFF also expires
known session and pending-OTP cookies, then redirects to `/auth`. API 4xx
details remain actionable while 5xx details are hidden behind a retry message.

### Signed-in bookings list

`GET /bookings` is a same-origin BFF over `GET /api/bookings` (`SessionGuard`).
Guests redirect to `/auth?redirectTo=/bookings`. Tabs use hireApp
`?status=active|confirmed|completed|cancelled`. Rows show car image / make /
model / year, reference, Lagos dates, amount, and a completed-review badge.
List rows link to `/bookings/:id`, where customer mutations live.

### Signed-in booking detail

`GET /bookings/:id` is a same-origin BFF over `GET /api/bookings/:bookingId`
(`SessionGuard`). Guests and 401s redirect to `/auth?redirectTo=`. Missing
bookings 404. The page is hireApp detail (header, type note, timeline,
locations, chauffeur, airport flight, payment summary) inside the public
shell. Cancel uses API `canCancel` and `PATCH /api/bookings/:bookingId/cancel`.
Modify uses API `canEdit` and `modificationCutoffAt`, then submits pickup time
and location changes to `PATCH /api/bookings/:bookingId`. Extension uses each
leg's API-owned `canExtend` and `maxExtendableHours`, sends a stable
`Idempotency-Key` to `POST /api/bookings/:bookingId/extensions`, and protects
the signed-in payment callback identity in the encrypted HttpOnly payment
session. Payment confirmation delegates to
`POST /api/payments/extension-confirmation`; the web does not duplicate
extension pricing because the API has no preview contract. This slice does not
download a receipt; review and guest access are described below.

### Guest booking lookup

`POST /bookings/lookup` delegates to public API `POST /api/bookings/guest-access`
with a normalized booking reference and email, then preserves the API's generic
accepted response to avoid booking enumeration. The emailed
`/bookings/guest?token=...` URL is a short-lived exchange route: the Worker
validates the opaque token through `GET /api/bookings/guest-access`, stores it
in an encrypted, booking-scoped HttpOnly cookie, and redirects immediately to
the clean `/bookings/:id` URL.

The canonical detail loader accepts either the signed-in session or the scoped
guest cookie. Guest responses are projected into the existing booking detail
visuals with a total-only payment summary and no modify, cancel, or extension
actions. Guest and token routes are `no-store`, `noindex`; the exchange response
also uses `Referrer-Policy: no-referrer`. Guest mutation remains an API gap.

### Customer booking reviews

Completed bookings owned by the signed-in customer render the review at
`/bookings/:bookingId#review`, matching the URL in the API's completion email.
The existing booking detail response supplies the current review, so the
loader does not add a second review read. Create delegates to guarded
`POST /api/reviews/create`; update delegates to guarded
`PUT /api/reviews/:reviewId`. The API remains authoritative for booking
completion, customer ownership, assigned chauffeur, the 30-day creation
window, duplicate prevention, and the 7-day edit window.

The UI collects required overall, car, chauffeur, and service ratings plus an
optional 2,000-character comment. Completed booking rows retain the existing
`Reviewed` / `Review Pending` badge. Guest access never renders or accepts
review mutations, fleet-owner booking access does not expose customer review
controls, and moderated review content is not rendered. The customer instead
sees a neutral unavailable status for a moderated review. The web also avoids
offering creation after the API's 30-day window or without an assigned
chauffeur, while the API remains authoritative on submission. Customer
deletion remains unavailable.

### Public car slugs and SEO

hireApp canonical URLs are `{year}-{make}-{model}-{id.slice(0, 13)}`, for
example `/cars/2019-lexus-ux-f-sport-cmmz4f7x00000`. The year-make-model
prefix is the ranking-relevant part. The trailing id only disambiguates two
listings with the same name. hireApp sitemap and any already-indexed Tripdly
URLs use that short form.

`GET /api/cars/:carId` validates a full CUID. This slice therefore ships
`{year}-{make}-{model}-{fullCuid}` and 404s the 13-character prefix. That is
the honest BFF choice. It is not the better SEO or cutover choice.

What already fits:

- title, description, and canonical omit booking query params;
- wrong full-CUID slugs 301 to the generated slug;
- Vehicle + Breadcrumb JSON-LD sit on the detail page.

What does not fit:

- existing hireApp URLs and sitemap locs will 404 after cutover unless we
  301 them;
- the extra 12 CUID characters add no keywords and make share URLs longer;
- raw `/cars/{cuid}` works, then 301s, which is fine, but short slugs do not.

Better end state, in the API, not Prisma in the Worker:

1. Add public prefix lookup (`id startsWith` the last hyphen segment, or an
   explicit `?idPrefix=` / slug resolve endpoint).
2. Decide one canonical shape and keep it forever. Preferred for parity:
   restore the 13-character hireApp slug and 301 full-CUID and raw-CUID
   requests to it.
3. Acceptable alternative: keep full CUID as the new canonical, but still
   resolve short slugs and 301 them so indexed equity moves.
4. Emit that same canonical from `/sitemap.xml`. The sitemap already uses
   `generateCarSlug`; do not let those drift.

13 characters was hireApp's uniqueness compromise, not a search keyword.
Do not invent a human slug (`2019-lexus-ux-f-sport`) without a unique key;
duplicate year-make-model listings would collide.

### Other car-detail notes

- Vehicle JSON-LD omits `aggregateRating` because hireApp did. The car DTO
  already has `averageRating` and `totalReviews`. Adding the schema is an
  SEO improvement once we decide to exceed hireApp, not an API gap.
- Features and transmission copy are still static hireApp text. Seating
  correctly uses `passengerCapacity`. Do not invent DTO fields for the rest.
- If `GET /api/reviews/car/:carId` fails, the page hides the review CTA even
  when the car DTO has a count. Safer than a broken sheet; weaker than
  showing the car-level rating with a retry. Review paging currently
  `fetcher.load`s the car route, so `getPublicCar` starts again. Later PR:
  a reviews-only web resource over the same API. No new API work.
- Customer `/auth`, `/verify`, and `POST /logout` are a same-origin BFF over
  Better Auth. The Worker sends `role` plus a built `Origin`/`Referer` from
  `APP_ORIGIN`, relays every `Set-Cookie`, and never stores the bearer token
  or sends `X-Client-Type: mobile`. The public layout reads `/auth/session`
  when a session cookie is present and swaps the header/mobile nav to Log
  out. Signed-in `/bookings` lists `GET /api/bookings` by status. Signed-in
  `/bookings/:id` reads `GET /api/bookings/:bookingId`. Signed-in
  `/profile` reads and patches `GET|PATCH /api/users/me`. Signed-in
  `/referrals` reads `GET /api/referrals/user`; its share URL is rebuilt from
  trusted `APP_ORIGIN`, matching mobile instead of trusting an API-host URL.
  Fleet-owner `/fleet-owner/login`, `/fleet-owner/verify`, and
  `/fleet-owner/logout` reuse the customer login/verification UI and the same
  BFF cookie relay with
  `role: fleetOwner` and a canonical `/fleet-owner/login` referer. Pending
  fleet verification uses a separate HttpOnly cookie from customer OTP.
  `/fleet-owner` requires the `fleetOwner` role from `GET /auth/session`;
  this web check is a UX guard and every fleet API endpoint remains
  authoritative. Admin/staff authentication follows the same flow under
  `/admin`, stores the selected role in a separate pending OTP cookie, and
  protects the console shell with React Router middleware.
  Production API `TRUSTED_ORIGINS` must include `https://tripdly.com`.
  PR preview hosts (`https://pr-*-hyre-web-preview.tripdly.workers.dev`)
  will fail OTP until the API trusts them. Local `APP_ORIGIN` is
  `http://localhost:5173`.
- `/fleet-owner/payout-transactions` lists the API's most recent 30-day payout
  window with status filtering and server pagination, plus the all-time payout
  summary. The API does not return booking start/end dates, so the web table
  intentionally omits those legacy columns and does not link to the unverified
  fleet booking detail route.
- `/fleet-owner` displays the API-owned fleet overview and 7-, 30-, or 90-day
  earnings aggregates. The web groups those supported ranges by day, week, or
  month respectively. It intentionally omits legacy dashboard widgets that
  need unavailable chauffeur, booking-list, utilization, or next-payout
  contracts.
- `/robots.txt` and `/sitemap.xml` are web-owned. Production robots allow the
  public site and point at `https://tripdly.com/sitemap.xml`. Preview and
  local robots send `Disallow: /`. The sitemap lists existing static pages
  plus car locs from paged `GET /api/cars/search?limit=50` (max 20 pages),
  using `generateCarSlug` so locs match car-detail canonicals. It intentionally
  omits signed-in `/referrals`, and still omits partners and
  `/chauffeur-service-lagos` until those public routes exist. A failed later
  search page keeps the pages that already succeeded.
  A later dedicated public-car list can replace paging if the fleet outgrows
  the cap.
- Card hrefs always include `bookingType=DAY`. Canonical stays clean. Fine
  for UX; default `DAY` could be omitted later for shorter share links.
- Places autocomplete/resolve and `GET /api/search-flight` /
  `GET /api/calculate-trip-duration` are wired on the car booking card.
  hireApp sent `arrivalTime` on trip duration; the API only accepts
  `destination`. The BFF forwards `CF-Connecting-IP` as `X-Forwarded-For`
  so API per-IP limits apply per browser, not per Worker egress.
  The car booking card re-looks up a flight from `flightNumber` + `from`
  in the URL so homepage search still fills the airport pickup address.
  Web does not rewrite `from`/`to`/`pickupTime` from the
  flight window yet — that stays with booking create (Phase 5).
- `POST /api/ai-search` is wired from the home/search modal. The BFF
  redirects to `/search` with the extracted params. It does not re-check
  airport flights in the modal. `GET /api/rates` is still unused.
