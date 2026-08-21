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
- `POST /api/bookings/:bookingId/extensions`
- provisional `GET|POST /api/bookings/:bookingId/airport-completion` using `X-Booking-Completion-Token`
- `POST /api/payments/initialize`
- `GET /api/payments/status/:txRef`
- `POST /api/payments/booking-confirmation`
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
- provisional chauffeur airport-completion endpoints under `/chauffeur/airport-trips` (currently uncommitted)

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
- `/bookings/:id`
- `/bookings/:id/extend`
- `/bookings/payment-status`
- `/referrals`
- review reads, create, and owner update
- account deletion

**Gap unless an endpoint is added**

- `/profile` update -> no `PATCH /api/users/me` equivalent was observed
- `/bookings/lookup` -> no guest email/reference lookup endpoint was observed
- booking receipt PDF -> no dedicated booking receipt endpoint was observed
- review deletion -> observed DELETE is admin-only moderation

**Verify**

- every legacy booking mutation and cancellation policy
- referral attribution inputs during signup/booking
- referral validation public/signup behavior because the REST validation endpoint requires a session
- referral eligibility for airport-pickup bookings
- booking idempotency and guest `paymentStatusToken` persistence/header forwarding

### Fleet owner

**Available or closely matched**

- cars list/detail/create/update/upload
- promotions
- booking chauffeur assignment
- payout list/summary

**Verify**

- dashboard overview/earnings: the legacy dashboard also needs owner-driver state, utilization, chauffeur availability, unassigned/recent bookings, and next payout
- fleet booking detail through the generic booking endpoint requires ownership/field parity verification
- `/fleet-owner/payout-transactions` may map to dashboard payout endpoints
- exact car onboarding/document workflow
- airport-completion controls; their API controller and migration are currently uncommitted

**Gap unless another endpoint is discovered**

- fleet-owner onboarding completion
- bank-account resolution and payout-details update
- `GET /api/fleet-owner/bookings` list/filter endpoint
- chauffeur list/create/detail/update
- fleet car deletion
- any fleet-specific report not covered by dashboard endpoints

### Admin

**Available or closely matched**

- car list/detail/approval/cover/image approval
- document approval/rejection actions
- fees/VAT/add-on rates
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
4. Emit that same canonical in the later sitemap slice. Do not let sitemap
   and `generateCarSlug` drift.

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
  showing the car-level rating with a retry.
- Sitemap (Phase 3 item 6) has no public “all approved cars” list. Categories
  and search are paginated. The sitemap will need a dedicated public list or
  an agreed composition of existing endpoints.
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
