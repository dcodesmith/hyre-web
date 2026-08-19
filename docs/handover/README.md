# Hyre Web rebuild handover

Status: planning baseline
Target: React Router v8 on Cloudflare Workers
UI reference: `/Users/afees/Projects/hireApp`
Backend: `/Users/afees/Projects/hyre-worker-nestjs`
API-consumer reference: `/Users/afees/Projects/hyre-mobile`

## Goal

Rebuild the existing `hireApp` web experience in this repository with the same user-facing UI and URLs, while changing the runtime architecture:

```text
Browser
  -> hyre-web (React Router v8 SSR/BFF on Cloudflare Workers)
  -> hyre-worker-nestjs (business API on Fly)
  -> Neon, Redis, S3, Flutterwave, Twilio, Resend
```

`hyre-web` is a web frontend and backend-for-frontend (BFF). It must not become a second business backend.

## Decisions

### Use React Router v8, not TanStack Start

React Router v8 is the chosen framework after a greenfield comparison that assigns zero value to compatibility with the old React Router app.

Weighted result:

- React Router v8: 87.9/100
- TanStack Start: 83.6/100

React Router wins for this form- and mutation-heavy product because of its mature progressive forms/actions, automatic revalidation, Web `Request`/`Response` model, production history, and instrumentation.

TanStack Start is a credible alternative and its server functions can implement the BFF. It is stronger for typed search parameters, explicit client caching, TanStack Query integration, and Cloudflare prerendering. It is currently a Release Candidate, while React Router v8 is stable.

React Router's search parameters require explicit runtime validation. Use per-route Zod URL contracts. API type safety must come from API DTOs/OpenAPI or shared transport schemas in either framework.

See [Framework decision](./00-FRAMEWORK-DECISION.md) for the weighted comparison and conditions that would change the decision.

### Use a BFF, not the mobile networking architecture

`hyre-mobile` is a reference for endpoint paths, payloads, error handling, and expected product behavior. Do not copy its client architecture directly.

Mobile stores bearer tokens and uses TanStack Query because it is a native client. Web SSR needs cookies available to route loaders. The recommended web flow is:

```text
Browser form/navigation
  -> same-origin React Router loader/action
  -> central server-only API client
  -> the API
```

The BFF:

- forwards the incoming session cookie to the API;
- relays every `Set-Cookie` header returned by Better Auth;
- maps API RFC 7807-style errors into route responses;
- keeps private API configuration out of browser bundles;
- provides same-origin progressive enhancement;
- enables authenticated SSR.

Direct browser-to-API requests should be exceptional, not the default.

### The API owns business behavior

Keep these out of `hyre-web`:

- Prisma and direct Neon access;
- Redis/BullMQ jobs and schedulers;
- payment, refund, payout, and webhook business logic;
- S3 credentials and storage operations;
- Twilio, Resend, SMTP, OpenAI, Anthropic, and FlightAware secrets;
- PDF generation;
- booking availability, pricing, promotions, referral, and status-transition rules;
- duplicated domain models that can drift from the API.

React Router loaders may compose multiple API reads for a page. Actions may validate web form shape, but the API must remain authoritative for domain validation.

## Current repository warning

`hyre-web` is currently a copy of the React Router v7 application, not an RR v8 Cloudflare scaffold. At handover time it still contains:

- roughly 98% of the legacy UI: about 90 shared routes, 150 shared components, and matching assets/styles;
- React 18, Vite 5, and React Router 7 dependencies;
- Prisma, `pg`, Nodemailer, PDFKit, AWS, Twilio, Better Auth server code, and other backend dependencies;
- Vercel configuration and `@vercel/react-router`;
- direct database services and duplicate API/resource routes;
- active uncommitted airport-completion work.

The related airport-completion controller, migration, notifications, and status-change work in `hyre-worker-nestjs` are also uncommitted. Treat those endpoints as provisional until that work is reviewed and committed.

Do not bulk-delete or bulk-commit these working trees. The API repository also contains untracked backup/key-like artifacts that require a secrets review and must not be swept into source control.

`hyre-web` is not the production web deployment. Once its active patches are
isolated on their existing branches, the RR v8 foundation may replace the
tracked RR7 root rather than create a temporary second application. `hireApp`
remains the immutable, deployable parity reference throughout migration.

Do not delete legacy files from `hireApp`, or remove an implemented capability
from the migration reference, until:

1. the current work and patches in every repository are safely preserved;
2. a visual and route baseline has been captured;
3. the corresponding API endpoint has been verified;
4. the replacement route passes parity tests.

## Source-of-truth order

When implementations disagree:

1. API controllers, DTOs, guards, and tests define the API contract and authorization.
2. `hyre-mobile` demonstrates currently exercised API behavior.
3. `hireApp` defines web UI, URLs, SEO, accessibility, and browser workflows.
4. Old `hireApp` server services are migration references only; they do not define the new runtime architecture.

## Handover documents

- [Framework decision](./00-FRAMEWORK-DECISION.md)
- [Target architecture](./01-ARCHITECTURE.md)
- [Migration plan](./02-MIGRATION-PLAN.md)
- [Route and API readiness](./03-ROUTE-API-READINESS.md)
- [Cloudflare runbook](./04-CLOUDFLARE-RUNBOOK.md)
- [Implementation skills and React effect policy](./05-IMPLEMENTATION-SKILLS.md)
- [App structure](./06-APP-STRUCTURE.md)

## Definition of done

The rebuild is complete when:

- public, customer, fleet-owner, chauffeur, and admin web flows have functional and visual parity;
- all business data and mutations go through the API;
- authenticated routes SSR correctly using the BFF cookie relay;
- no Prisma client or business-service implementation remains in the web runtime;
- webhooks and scheduled work terminate at the API, not Cloudflare;
- public routes retain metadata, canonical URLs, sitemap, robots rules, and structured data;
- accessibility and critical Playwright journeys pass;
- direct `useEffect` usage is mechanically restricted to reviewed external-integration hooks;
- preview and production Workers use separate API origins/configuration;
- rollback has been tested against the post-migration database;
- Better Auth 1.4/1.6 session compatibility has been proven, or rollback explicitly forces a new login;
- exactly one deployment owns each webhook and scheduled job during normal operation and rollback;
- the old app can be rolled back to during the cutover window.
