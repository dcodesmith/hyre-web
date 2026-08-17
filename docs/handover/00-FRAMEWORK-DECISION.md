# Framework decision: React Router v8 vs TanStack Start

Decision date: 2026-08-17
Decision: React Router v8 Framework Mode
Hosting: Cloudflare Workers

## Decision rule

This is a greenfield framework decision. React Router v7 compatibility and migration effort have zero weight.

The selected framework must:

- reproduce every public, customer, fleet-owner, chauffeur, and admin capability in `hireApp`;
- support SSR, streaming, SEO, authenticated BFF requests, and Cloudflare Workers;
- handle a large form- and mutation-heavy application safely;
- leave room for richer caching, typed contracts, observability, and future React features;
- be suitable for a production booking and payment product today.



## Result

Weighted score:

- React Router v8: **87.9/100**
- TanStack Start: **83.6/100**

React Router wins on production maturity, progressive forms/actions, automatic post-mutation revalidation, Web `Request`/`Response` ergonomics, and first-class instrumentation.

TanStack Start wins on native typed search parameters, explicit client caching, TanStack Query integration, and static prerendering on Cloudflare.

The gap is not large. Both can deliver the application. React Router is the better overall fit for this product's workload.

## Weighted assessment



### Forms, mutations, and progressive enhancement — 16%

- React Router: 10/10
- TanStack Start: 7/10

The application contains many login, booking, payment, fleet, approval, upload, filter, and admin forms. React Router provides one integrated model:

- progressively enhanced `<Form>`;
- route actions;
- `useFetcher` for non-navigation mutations;
- pending and optimistic UI;
- automatic active-loader revalidation after actions.

Core workflows retain basic operation before hydration. TanStack Start can implement these flows with server functions, server routes, and form libraries, but it does not currently provide an equally cohesive progressive-form model.

### Framework maturity and operational ecosystem — 14%

- React Router: 9.5/10
- TanStack Start: 6.5/10

React Router v8 is stable and builds on the production lineage of React Router and Remix.

TanStack Start is feature-complete and its API is considered stable, but its official documentation still labels it **Release Candidate**. That is acceptable for some products, but it adds avoidable framework and operational risk to payments, authentication, and several role-scoped portals.

### Cloudflare support — 12%

- React Router: 8.5/10
- TanStack Start: 9/10

Both are officially supported by Cloudflare's Vite plugin with SSR and Workers-local development.

TanStack has one meaningful advantage: Cloudflare supports TanStack Start static prerendering. Cloudflare's React Router integration currently supports SSR but not framework prerendering or SPA mode.

Dynamic SSR plus deliberate edge caching is accepted for this application. If static prerendering becomes mandatory, revisit the decision.

### Authentication and security — 12%

- React Router: 8.5/10
- TanStack Start: 9/10

Both can implement the required cookie-relaying BFF securely.

TanStack Start has strong server-function validation, middleware, session primitives, and CSRF middleware. React Router has middleware, actions, raw Web requests/responses, and mature cookie/session utilities. The existing Nest API remains the actual authorization boundary in either framework.

React Router's direct response control is especially useful for preserving multiple Better Auth `Set-Cookie` headers, redirects, status codes, and Problem Details.

### Typed routing and search parameters — 10%

- React Router: 7/10
- TanStack Start: 10/10

TanStack Router is materially better here:

- typed routes and navigation;
- validated typed search parameters;
- typed loader dependencies;
- strong URL-state ergonomics.

React Router generated route types cover params, loader/action data, and route modules, but raw search parameters are not automatically validated or typed.

Mitigation for React Router:

- define Zod URL schemas per search-heavy route;
- expose canonical parse/serialize helpers;
- test defaults, arrays, pagination, filtering, and sorting;
- never pass unvalidated URL values directly to Nest.



### API/BFF ergonomics — 10%

- React Router: 9.5/10
- TanStack Start: 9/10

React Router loaders/actions naturally receive Web `Request` objects and return values or `Response` objects. That closely matches the Nest HTTP boundary.

TanStack `createServerFn` is a viable and strongly typed BFF primitive. It does not, however, make the external Nest boundary type-safe by itself. Both choices still require generated OpenAPI types or explicit runtime schemas.

### Caching and invalidation — 10%

- React Router: 8/10
- TanStack Start: 9.5/10

TanStack Start and Query provide stronger explicit client caching, stale-time control, preloading, cross-route reuse, polling, and mutation invalidation.

React Router is fresh-by-default and automatically revalidates active loaders after actions. That is safer for booking inventory, payment state, role-scoped dashboards, and other data where accidental staleness is costly.

React Router can add TanStack Query selectively for demonstrated polling or highly interactive cache requirements. Choosing React Router does not exclude TanStack Table or Query.

### SSR, streaming, and SEO — 8%

- React Router: 9/10
- TanStack Start: 9/10

Both support full-document SSR, streaming, metadata, error handling, code splitting, and Cloudflare deployment. Both can reproduce the current public SEO surface.

### Observability and testing — 5%

- React Router: 9/10
- TanStack Start: 7.5/10

React Router v8 provides first-class server and client instrumentation around:

- requests;
- route middleware;
- loaders and actions;
- navigations and fetchers;
- matched route patterns and response status.

Both remain compatible with normal unit, integration, contract, Playwright, and Cloudflare runtime tests.

### Future React and RSC options — 3%

- React Router: 6.5/10
- TanStack Start: 7.5/10

Both have experimental React Server Component work. Neither RSC implementation is stable enough to define the initial architecture.

The application can adopt future framework features later without making RSC a launch dependency.

## Capability check

React Router v8 can provide everything currently required:

- public and authenticated SSR;
- streaming secondary data;
- SEO metadata, robots, sitemap, structured data, and canonical URLs;
- customer, fleet-owner, chauffeur, admin, and staff route trees;
- progressive forms and non-navigation mutations;Ok
- file uploads and streamed downloads through the Nest API;
- Better Auth cookie relay;
- route middleware and role-aware UX guards;
- typed route params and loader/action data;
- optimistic and pending UI;
- Cloudflare bindings, preview deployments, custom domains, and observability;
- selective TanStack Query/Table usage where beneficial.

It also improves on the legacy architecture by adding:

- a clean API-only business boundary;
- RR v8 request/route instrumentation;
- Cloudflare-native SSR;
- Zod URL contracts;
- generated Nest API contracts when OpenAPI is added;
- isolated contract and end-to-end tests;
- explicit cache and error policy;
- no Prisma or business secrets in the web runtime.



## Conditions that would flip the decision

Choose TanStack Start before implementation if one of these becomes mandatory:

1. Cloudflare static prerendering is a launch requirement.
2. Framework-native compile-time search-parameter typing is non-negotiable.
3. The product becomes primarily a client-cache application with extensive polling, offline behavior, cross-route cache reuse, and optimistic writes.
4. Progressive enhancement is intentionally dropped and JavaScript is mandatory.
5. TanStack Start reaches stable v1 and demonstrates comparable production operations before foundation work begins.
6. TanStack's RSC model stabilizes first and RSC becomes a strategic requirement.

If none applies, remain on React Router v8.

## Baseline constraints

- Use a clean current RR v8 Cloudflare scaffold.
- Do not upgrade or inherit the copied RR v7 dependency foundation.
- Use SSR; Cloudflare RR prerendering is unavailable today.
- Use loaders/actions as the BFF boundary.
- Use Zod URL contracts to close the typed-search gap.
- Use TanStack Query selectively, not as a second default route-data system.
- Exclude experimental RSC from the initial release.

## References

- [https://reactrouter.com/](https://reactrouter.com/)
- [https://reactrouter.com/api/components/Form](https://reactrouter.com/api/components/Form)
- [https://reactrouter.com/how-to/instrumentation](https://reactrouter.com/how-to/instrumentation)
- [https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)
- [https://tanstack.com/start/latest/docs/framework/react/overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- [https://tanstack.com/start/latest/docs/framework/react/guide/hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
