# Migration plan

## Principles

1. Preserve behavior before improving architecture or visual design.
2. Port presentation; replace business implementation.
3. Migrate vertical journeys, not folders in bulk.
4. A route moves only when its required API endpoints exist.
5. Keep `hireApp` deployable until production cutover.
6. Do not combine framework, UI redesign, and API redesign in one change.

## Pull request strategy

Deliver the rebuild as small stacked pull requests that merge in dependency
order. Each PR must be useful and verifiable once the PR below it has merged;
unrelated backend gaps or active feature work must not be swept into the stack.

Initial stack:

1. **Handover and baseline** — architecture decisions, route/API readiness,
   repository-state preservation, screenshots, metadata, and critical journeys.
2. **RR v8 Cloudflare foundation** — current official scaffold, SSR Worker
   runtime, bindings, scripts, and a minimal route.
3. **BFF transport** — central API client, endpoint builders, runtime response
   schemas, Problem Details, aborts, timeouts, and one public API call.
4. **Security and preview** — request IDs, security/cache headers,
   observability, staging bindings, preview deployment, and smoke tests.
5. **Visual shell** — approved styles, assets, shadcn primitives, shared
   layouts, navigation, and shell-level visual tests.
6. **Public vertical journeys** — static/SEO, home, search, and car detail.
7. **Authentication** — OTP, complete cookie relay, session/logout, and
   role-specific Origin/Referer behavior.
8. **Customer, fleet, and admin journeys** — small capability-focused stacks,
   gated by verified API contracts.
9. **Legacy removal and cutover** — delete replaced backend code, verify
   production configuration, rehearse rollback, and switch traffic.

Cloudflare setup begins in the second PR, immediately after preservation. Local
Workers execution and preview deployment are foundation concerns; production
domains, DNS, secrets, and traffic switching remain cutover concerns.

Use the initial pragmatic organization from `01-ARCHITECTURE.md`: thin routes,
shared UI under `components`, and capability-grouped API adapters under
`lib/api`. Extract complex vertical slices selectively rather than imposing
them on every route.

## Phase 0: preserve the baseline

- Preserve patches and working-tree state for `hyre-web`, `hireApp`, `hyre-worker-nestjs`, and `hyre-mobile`.
- Treat the uncommitted API airport-completion controller/migration as unavailable until reviewed and committed.
- Do not bulk-stage the API repository; exclude backup dumps and key-like artifacts from source control and rotate any credential found outside approved secret storage.
- Record the commit hashes and intentional patches of all source repositories.
- Capture desktop and mobile screenshots for every major route state.
- Record existing redirects, status codes, metadata, and canonical URLs.
- Run or repair the legacy Playwright suite and identify critical journeys.
- Export a production-like route inventory without secrets or customer data.
- Decide the production web and API custom domains.

Exit criteria:

- UI reference is immutable and reproducible.
- Critical journeys and route list are documented.
- No current work will be lost during scaffold replacement.

## Phase 1: establish a greenfield RR v8 Cloudflare foundation

The current repository is React Router 7/React 18/Vite 5 and includes the Vercel
preset. It does not serve production. After active patches are isolated, replace
the tracked root with the clean foundation; use `hireApp` as the immutable,
deployable parity fixture and source of approved presentation code.

Required RR v8 minimums:

- Node `22.22.0+`;
- React and React DOM `19.2.7+`;
- Vite `7+`;
- ESM-compatible tooling.

Foundation tasks:

- scaffold RR v8 framework mode with `@cloudflare/vite-plugin`;
- add `workers/app.ts`, `wrangler.jsonc`, and generated Worker binding types;
- remove Vercel preset/configuration from the target architecture;
- replace the Node `PassThrough`-based `entry.server.tsx` with the Cloudflare/RR v8 request entry;
- enable SSR;
- add `API_ORIGIN` as a server-only Worker variable;
- create the central API client and Problem Details parser;
- decide and establish the API Zod/OpenAPI/shared-contract publication path;
- implement security headers and request IDs;
- set up test, typecheck, lint, preview, and deploy scripts;
- configure preview and production Workers separately.

Generate the current official RR v8 Cloudflare scaffold and port only approved
routes, UI, styles, assets, and browser-safe utilities. Do not perform an
in-place upgrade of the copied v7 dependency tree or maintain a temporary
second application under `apps/web`.

Do not add Prisma or `DATABASE_URL` to the Worker.

Architecture constraint: Cloudflare's React Router integration currently supports SSR but not framework prerendering. Dynamic SSR plus explicit edge caching is the accepted SEO strategy. Reopen the framework decision before implementation if static prerendering becomes mandatory.

Exit criteria:

- hello-world SSR runs under the local Workers runtime;
- preview deployment can call the API `GET /health` and one public endpoint;
- no Node-only backend dependency is required by the Worker.

## Phase 2: port the visual system

Port presentation-only assets first:

- Tailwind tokens and global CSS;
- fonts and static assets;
- reusable UI primitives;
- icons;
- error-page presentation;
- shell components such as header, footer, mobile navigation, sidebars, dialogs, and toasts.

Rules:

- copy components with minimal markup/class changes for visual parity;
- remove server imports before adding a component to the new route tree;
- do not copy `.server.ts` service implementations;
- do not rename every component during migration;
- keep accessibility behavior and keyboard interaction intact.

Add screenshot tests for:

- public desktop/mobile shell;
- authenticated customer shell;
- fleet-owner shell;
- admin shell.

Exit criteria:

- shell-level visual regression is approved at representative breakpoints.

## Phase 3: public and SEO routes

Suggested order:

1. home and static legal/about/FAQ pages;
2. vehicle categories/search;
3. vehicle detail and reviews;
4. partner landing/search/detail;
5. AI search, places, trip duration, and flight search;
6. robots, sitemap, canonical metadata, structured data, and API-discovery resources.

Use public API endpoints where available. Do not port legacy database queries.

Unknown partner behavior must be verified against `/api/cars/search` and `/api/cars/:carId`; add API endpoints or parameters if the API does not preserve partner scoping.

Exit criteria:

- public URL and query-string parity;
- metadata parity;
- crawlable SSR HTML;
- no authenticated data leaks into edge caches.

## Phase 4: web authentication

Implement auth as a BFF flow before protected pages.

- OTP request action -> the API's Better Auth endpoint.
- OTP verify action -> the API, then relay all `Set-Cookie` headers.
- include `role` in both OTP payloads;
- forward a trusted canonical `Origin` and role-specific `/auth`, `/fleet-owner`, or `/admin` referer;
- root/session loader -> forward incoming cookie to the API `/auth/session`.
- logout action -> API sign-out, relay cookie deletion.
- role helpers -> use session roles returned by the API.
- route guards -> redirect for UX; the API remains authoritative.
- add web and preview origins to the API `TRUSTED_ORIGINS`.

Test:

- user, fleet owner, and admin OTP journeys;
- invalid/expired OTP;
- cookie survives document requests and client navigation;
- logout clears session;
- role mismatch;
- missing/incorrect role, Origin, and Referer;
- Better Auth-specific errors and rate-limit responses;
- expired session;
- preview origin;
- multiple `Set-Cookie` preservation.

Exit criteria:

- authenticated SSR works without browser bearer-token storage.

## Phase 5: customer journeys

Port vertical slices:

1. profile and account deletion;
2. booking pricing preview and creation;
3. payment initialization/status/confirmation;
4. booking list/detail/cancellation;
5. extensions;
6. guest lookup if supported;
7. referrals;
8. review creation/edit; customer deletion is not currently exposed;
9. receipt/download behavior.

Booking/payment requirements:

- persist one idempotency key for each booking attempt and reuse it across safe retries;
- handle price-change, in-progress, and reused-key API errors;
- store guest `paymentStatusToken` in an encrypted/integrity-protected HttpOnly web session;
- forward guest tokens only through `X-Payment-Status-Token` for status, confirmation, and expiration;
- remove the guest token when the flow completes or expires.

Each slice requires:

- endpoint and DTO confirmation;
- loading, empty, success, validation, forbidden, not-found, conflict, and outage states;
- responsive visual parity;
- Playwright coverage;
- no legacy service import.

## Phase 6: fleet-owner and chauffeur journeys

Do not begin a screen until the API readiness matrix is green.

Fleet-owner OTP authentication, cookie-backed SSR session loading, logout, role
enforcement, the fleet car list/detail slice, promotions, the API-backed
dashboard overview/earnings, and the read-only payout list/summary are
implemented.
The car list keeps filter, sort, column visibility, and pagination state in the
URL while filtering the already-loaded owner inventory in the browser. Car
editing and rejected image/document replacement are implemented through the
owner-scoped API endpoints. Car create remains separate until the exact
onboarding/document workflow is verified. Legacy dashboard extras without API
contracts, chauffeur management, onboarding, fleet booking lists, car deletion,
and bank details remain gated by the API readiness matrix. Airport completion
exists in the API but stays separate from these initial console slices.

Port section layouts before individual screens so nested route guards and navigation are tested once.

## Phase 7: admin journeys

Admin API coverage is currently incomplete compared with the legacy UI. Treat missing controllers as backend backlog, not permission to copy Prisma into the Worker.

Admin/staff OTP authentication, logout, role enforcement, and the responsive
console shell are implemented. The admin car review list/detail, image and
document approve/reject actions, cover selection, and final car approval use
the guarded API contracts. Admin-only fee, VAT, and security-detail rate
windows use `GET /api/rates/admin` and the guarded create/end endpoints under
`/api/rates`. The shell exposes no unsupported business screens; add navigation
only with each verified API-backed slice.

Prioritize remaining work:

1. financial reconciliation, including the legacy booking reconciliation aggregate;
2. owners/chauffeurs;
3. reviews;
4. referrals;
5. reports and staff.

The standalone pending-document/image queue remains an API gap. Per-car asset
review is complete through `GET /api/admin/cars/:carId`. Dashboard aggregate
parity remains an API gap. Platform fee and VAT windows can be created but
cannot be ended or changed through the current API; the web does not invent
those missing mutations.

## Phase 8: remove duplicate backend code

Delete from `hyre-web` only after replacement routes pass:

- Prisma schema/client/migrations and database module;
- business services under `app/services`;
- jobs/queues/email/messaging implementations;
- payment, Twilio, FlightAware, and other inbound webhooks;
- PDFKit and file-system receipt generation;
- server-side S3/OpenAI/Flutterwave/Twilio/Resend packages;
- Vercel packages and configuration;
- backend environment variables;
- test-only API routes that belong to the API.

Retain web presentation utilities and transport-neutral schemas only when still used.

## Phase 9: cutover

- Run full parity tests against the staging API and staging Worker.
- Load-test public search and the BFF-to-API path.
- Validate cache and security headers.
- Verify webhook URLs still target the API.
- Configure DNS and production Worker routes.
- Add production web origin to the API before switching traffic.
- Verify the legacy app against the final database schema and API-owned jobs/webhooks.
- Prove cross-version session compatibility or announce that rollback forces reauthentication.
- Nominate exactly one owner for every webhook and scheduled job in both forward and rollback states.
- Deploy with a documented rollback to `hireApp`.
- Monitor auth, upstream errors, payment journeys, and booking creation.
- Keep rollback available through an agreed observation window.

## Route-level migration template

Use this checklist for every route:

```text
[ ] Legacy URL, params, query string, and role captured
[ ] Visual states/screenshots captured
[ ] API endpoint and DTO verified
[ ] Missing backend behavior tracked separately
[ ] Loader/action uses central API client
[ ] No database/business service import
[ ] Problem Details mapped
[ ] Metadata and status codes preserved
[ ] Loading/error/empty/pending states implemented
[ ] Accessibility checked
[ ] Visual regression passed
[ ] Integration/Playwright journey passed
[ ] Legacy implementation eligible for removal
```

## Testing strategy

### Unit

- transport schema parsing;
- Problem Details mapping;
- cookie/header relay;
- URL/query builders;
- role and redirect helpers.

### Contract

- web transport expectations against the API test/staging;
- all documented status codes;
- response schemas for critical booking/payment/auth flows.

### Integration

- route loaders/actions with a mocked HTTP API server;
- multiple cookies;
- timeout/abort behavior;
- upload and binary download behavior.
- no direct database fixture or `DATABASE_URL` dependency.

### End-to-end

- run against an isolated API test environment with disposable data;
- public search -> car -> booking;
- OTP login/logout for each role;
- payment status;
- booking change/cancel/extension;
- fleet car and booking workflows;
- admin approval and financial workflows;
- SEO and noindex assertions.

### Visual

Compare `hyre-web` to `hireApp` at:

- 375px;
- 768px;
- 1280px;
- key empty/loading/error/authenticated states.
