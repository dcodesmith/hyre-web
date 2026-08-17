# Target architecture

## Responsibilities

### `hyre-web` on Cloudflare Workers

- Render React Router documents and route data.
- Preserve the existing UI, URL structure, metadata, and progressive enhancement.
- Call Nest from loaders and actions through one server-only client.
- Relay Better Auth cookies and normalize API errors.
- Serve static assets, robots, sitemap, and other web-only resources.
- Apply web security headers, CSP, redirects, and cache policy.

### `hyre-worker-nestjs` on Fly

- Authenticate users and enforce roles.
- Own all business rules and database access.
- Own payments, files, notifications, queues, jobs, webhooks, and third-party calls.
- Return stable transport DTOs and RFC 7807-style errors.
- Serve both web and mobile clients without client-specific business forks.

### `hyre-mobile`

- Remains an independent native client.
- Provides examples of endpoint usage and product behavior.
- Must not be imported by or copied wholesale into the web app.

## Request flows

### Public SSR read

```text
GET /search?... -> RR loader -> Nest GET /api/cars/search?... -> HTML + route data
```

Use a short timeout and propagate the request abort signal. Cache only endpoints confirmed to be public and user-independent.

### Authenticated SSR read

```text
GET /bookings
  -> RR loader receives web-origin cookie
  -> forwards Cookie to Nest GET /api/bookings
  -> Nest SessionGuard validates Better Auth session
  -> RR renders authenticated HTML
```

### Mutation

```text
POST web form
  -> RR action
  -> validate transport/form shape
  -> Nest mutation
  -> map Problem Details or redirect on success
```

Do not duplicate pricing, availability, payment, or authorization checks in the action.

### Login and cookie relay

Nest Better Auth currently uses:

- base path `/api/auth`;
- email OTP;
- bearer support for mobile;
- production `__Host-` cookies;
- `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.

Because `__Host-` cookies are host-only, a cookie set directly by `api.example.com` is not sent to `www.example.com`. That would prevent authenticated SSR loaders from seeing it.

Use this web flow:

1. The browser submits the login form to a same-origin RR action.
2. The action calls the corresponding Nest Better Auth endpoint with the requested `role` in both OTP request and verification payloads.
3. The action copies all Nest `Set-Cookie` headers to its response.
4. The browser stores the host-only cookie for the web origin.
5. Later RR loaders receive that cookie and forward it server-to-server to Nest.
6. Logout relays every cookie-clearing `Set-Cookie` header the same way.

The auth implementation must preserve multiple `Set-Cookie` headers; never collapse them into a comma-separated value.

Forward the trusted web `Origin` and a canonical web `Referer` for Better Auth mutations, and add production/preview web origins to Nest `TRUSTED_ORIGINS`. Nest uses the referer pathname to authorize requested entry roles:

- `/auth...` -> `user`;
- `/fleet-owner...` -> `fleetOwner`;
- `/admin...` -> `admin` or `staff`.

A server-to-server auth call that omits `Origin`, omits `role`, or forwards the wrong referer path will fail or be interpreted as a customer login. Build the referer from the validated application origin and known route; never accept an arbitrary caller-supplied URL. Do not weaken Nest origin checks to `*`.

The Better Auth catch-all writes its own responses and does not pass through Nest's global exception filter. Parse Better Auth error bodies and rate-limit headers separately from normal Nest Problem Details.

## Booking and payment continuity

The API contract requires additional credentials that must survive redirects and safe retries:

- generate one stable `Idempotency-Key` for a booking attempt and reuse it for retries of that same payload;
- never silently generate a new key after an ambiguous timeout;
- for guest checkout, store the returned `paymentStatusToken` in an encrypted or integrity-protected, `HttpOnly`, `Secure`, `SameSite=Lax` web session;
- send that value to Nest as `X-Payment-Status-Token` for guest payment status, confirmation, and expiration requests;
- never expose the payment status token in a URL, client-readable cookie, local storage, logs, or analytics.

Authenticated payment requests use the relayed Better Auth cookie. The guest payment-status session is a separate web concern and must have an explicit lifetime and deletion policy.

## Proposed web modules

```text
app/
  lib/
    api/
      api.server.ts          # fetch, timeout, abort, headers, cookies
      problem-details.ts     # normalized Nest error shape
      contracts/             # temporary Zod transport schemas
      endpoints.ts           # centralized endpoint builders
    auth/
      auth.server.ts         # current user, role checks, cookie relay
  middleware/
    security.server.ts       # headers and same-origin mutation checks
  routes/
    ...                      # route modules and UI
workers/
  app.ts                     # Cloudflare fetch entry -> React Router
wrangler.jsonc
worker-configuration.d.ts
```

### Initial code organization

Start with a pragmatic route/component/API-module structure rather than a full
DDD, Clean Architecture, or vertical-slice implementation:

```text
app/
  routes/                    # thin RR loaders, actions, and route composition
  components/
    ui/                      # shadcn primitives
    layout/                  # shared shells and navigation
    booking/                 # reusable capability-specific UI
    search/
    fleet/
    admin/
  lib/
    api/
      api.server.ts          # shared HTTP transport
      endpoints.ts
      problem-details.ts
      contracts/             # temporary transport schemas
      cars.server.ts         # capability-grouped Nest calls
      bookings.server.ts
      payments.server.ts
      reviews.server.ts
      referrals.server.ts
      fleet.server.ts
      admin.server.ts
    auth/
      auth.server.ts
      cookie-relay.server.ts
    url/                     # Zod parse/serialize contracts
```

The dependency flow is:

```text
route loader/action -> capability API module -> shared API client -> Nest
route component     -> capability component -> components/ui
```

Use `.server.ts` for every server-only module. Do not expose server modules
through browser-safe component barrel files.

This structure is DDD-informed through capability names and clear boundaries,
but it does not recreate Nest aggregates, repositories, or domain services in
the web application. Introduce a vertical-slice folder only when a workflow
such as booking creation, payment completion, or fleet onboarding becomes too
cohesive or complex for the initial structure. Architecture should be earned
by demonstrated complexity rather than applied uniformly upfront.

Names may change, but preserve these boundaries:

- API transport code is centralized.
- Browser-safe and server-only modules are visibly separated.
- Route modules do not construct ad hoc API origins.
- UI components never import Worker bindings directly.
- Web modules never infer business permissions or state-transition rules that
  should be returned or enforced by Nest.

## API client requirements

The server client should:

- read `API_ORIGIN` from Cloudflare runtime bindings;
- accept a relative path only and reject absolute caller-provided URLs;
- set `Accept: application/json`;
- use JSON content type only when a JSON body exists;
- forward `Cookie`, `Origin`, request ID, and trace headers when appropriate;
- propagate `request.signal`;
- enforce an endpoint-appropriate timeout;
- parse JSON and non-JSON responses safely;
- preserve status and relevant response headers;
- parse Nest Problem Details:

```ts
type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errorCode?: string;
  errors?: unknown[];
  details?: Record<string, unknown>;
};
```

- distinguish expected 4xx responses from unavailable/timeout failures;
- never log cookies, bearer tokens, OTPs, or payment data.

Better Auth responses are an explicit exception to the Problem Details assumption and need a dedicated parser.

Do not copy mobile's `X-Client-Type: mobile`, secure-store token access, device-origin emulation, or auth invalidation events.

## API contracts

No Swagger/OpenAPI setup was found in the Nest service during this review. Mobile currently maintains manual TypeScript response types and casts parsed payloads.

Preferred direction:

1. Make Nest's existing Zod DTOs the contract source of truth.
2. Either extract transport schemas/error codes/endpoint definitions into a framework-neutral `@hyre/api-contracts` package consumed by Nest, web, and mobile, or generate OpenAPI from those schemas.
3. Generate a transport-only TypeScript client/types package when OpenAPI is available.
4. Validate critical untrusted responses at the web boundary.

Interim direction:

- define small Zod schemas/types under `app/lib/api/contracts`;
- mirror Nest transport DTOs, not Prisma models;
- include contract tests against a running API;
- record intentional nullable/optional fields;
- remove temporary schemas when generated contracts become authoritative.

Do not import Nest source files through cross-repository relative paths. That couples deployment and can accidentally bundle backend code.

Share transport schemas, endpoint definitions, Problem Details types, and pure error extractors only. Keep cookie forwarding, mobile bearer storage, React Router loaders, TanStack Query hooks, and React Native UI in platform-specific adapters.

## URL contracts

React Router's generated route types cover route parameters, loader/action data, and route modules. They do not make arbitrary `URLSearchParams` values validated or type-safe.

For every search-, filter-, or table-heavy route:

- define a Zod schema for accepted search parameters;
- parse once at the loader boundary;
- expose one canonical serializer for links and forms;
- define defaults and omission rules;
- validate arrays, dates, pagination, filtering, sorting, and enum values;
- reject or normalize unknown/invalid values deliberately;
- test parse/serialize round trips;
- pass only validated values to Nest.

This closes the most material capability gap relative to TanStack Router.

## Data-loading strategy

Use React Router loaders/actions as the primary web data layer.

- Loader data is already navigation-aware and SSR-aware.
- Use parallel API calls where page data is independent.
- Stream only secondary data that improves meaningful paint.
- Use `useFetcher` for non-navigation mutations.
- Use `<Form method="get">` for searchable/filterable URLs.
- Keep URL search parameters authoritative for search and admin tables.
- Use client-side caching only for highly interactive, repeatedly polled data where loaders are insufficient.

Do not introduce TanStack Query globally just because mobile uses it. Add it only for a demonstrated web requirement.

Successful route actions automatically revalidate active React Router loaders. This keeps rendered route data synchronized; it does not invalidate Nest caches, Cloudflare caches, or unrelated client caches. Those require explicit policy.

Experimental React Server Components are outside the initial architecture. Reassess after the selected framework's RSC support is stable and there is a measured product benefit.

## React effect policy

Treat direct `useEffect` calls as an external-system synchronization escape
hatch, not a default state-management or data-loading tool. The target is zero
direct effects in route modules and presentation components unless a reviewed
external integration requires one.

Prefer, in order:

1. derive values during render;
2. load server data in a React Router `loader`;
3. perform user-caused work in an event handler, `action`, or `useFetcher`;
4. represent filter and navigation state in the URL;
5. reset identity-sensitive state with a keyed component boundary;
6. subscribe to external stores with `useSyncExternalStore`;
7. isolate a genuine browser or third-party synchronization lifecycle in a
   narrowly named integration hook.

Do not use effects to:

- fetch route or server data;
- copy props or loader data into state;
- calculate values that can be derived during render;
- relay a click, submit, or other user event;
- reset state merely because an identifier changed;
- synchronize two pieces of React state;
- implement pending UI already exposed by navigation or fetcher state.

Legitimate effects are limited to external systems such as map widgets,
payment-provider SDKs, DOM observers, media/browser subscriptions, timers,
WebSockets, and third-party imperative APIs. They must have explicit setup and
cleanup, complete reactive inputs, and live inside a reviewed
integration-specific hook rather than a general component.

Add a mechanical lint restriction before feature migration accelerates:
presentation and route files should not import `useEffect` directly. Allow it
only in an explicitly reviewed integration-hook location. React Doctor and code
review supplement this gate; they do not replace it.

## Caching

Suggested initial policy:

- authenticated pages/data: `private, no-store`;
- auth routes and mutations: `no-store`;
- public vehicle search: conservative or uncached until inventory semantics are verified;
- static legal/about/FAQ content: cache at the edge;
- sitemap/robots: edge-cache with deliberate revalidation;
- immutable fingerprinted assets: long-lived public cache.

Never cache a response containing `Set-Cookie`, personalized data, availability holds, payment state, or role-scoped data.

Cloudflare cache configuration does not replace correct HTTP cache headers.

## Security

- Keep all API calls same-origin from the browser by using loaders/actions.
- Validate `Origin`/`Sec-Fetch-Site` on state-changing web requests.
- Keep `SameSite=Lax`, `HttpOnly`, `Secure`, and `__Host-` cookie protections.
- Preserve CSP, HSTS, referrer policy, frame restrictions, and permissions policy from the legacy server entry.
- Do not copy its current global `X-Robots-Tag: noindex` behavior into production.
- Apply global `noindex` to preview environments; in production apply it only to admin, fleet-owner, account, booking, debug, and API surfaces.
- Authorize in Nest on every request; RR role checks are UX guards only.
- Allowlist any generic proxy paths to avoid creating an open proxy.

## Observability

Generate or forward one request ID across:

```text
Browser -> Cloudflare Worker -> Nest -> downstream service
```

Capture:

- React Router request, middleware, loader, action, navigation, and fetcher timings;
- matched route patterns and response status through RR v8 instrumentation;
- route and API path template, not sensitive raw URLs;
- Worker request duration;
- Nest upstream duration and status;
- timeout and network-failure categories;
- Cloudflare colo and Nest deployment version where available.

Do not log form bodies by default.

## Web-only endpoints

Keep these as React Router resource routes when they represent the website itself:

- `/robots.txt`;
- `/sitemap.xml`;
- `/.well-known/api-catalog` if still required;
- `/openapi.json` only when it publishes or safely proxies a Nest-generated contract, not a separately maintained web specification;
- API documentation pages;
- content negotiation for website-owned representations.

Move or redirect webhooks, payment callbacks that perform business work, test activation routes, file proxying, and AI/business API routes to Nest.

## Airport-completion link ownership

The current uncommitted implementations expose the same chauffeur page URL in both web and Nest. Choose one owner before release.

Recommended:

- `hyre-web` owns `GET /chauffeur/airport-trips/:id/complete` and its confirmation UI;
- Nest owns JSON read/complete operations and all authorization/token validation;
- notification links are generated from a dedicated canonical web origin, not Nest `AUTH_BASE_URL`;
- Nest does not serve a competing HTML page at the public web URL.

Keep the existing Nest HTML endpoint only as a temporary fallback if required, with an explicit redirect/deprecation plan.
