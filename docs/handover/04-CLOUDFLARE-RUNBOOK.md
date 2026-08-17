# Cloudflare RR v8 runbook

Use the current official React Router v8 Cloudflare template as the configuration source. The snippets below describe intent; keep generated adapter code aligned with current Cloudflare and React Router releases.

Official references:

- https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/
- https://developers.cloudflare.com/workers/vite-plugin/
- https://reactrouter.com/upgrading/v7

## Runtime baseline

- React Router `8.3.x` framework mode with SSR enabled.
- React 19.2.7 or newer.
- Vite 7 or newer.
- Node 22.22 or newer for local tooling/builds.
- Cloudflare Workers runtime in local development, preview, and production.
- `@cloudflare/vite-plugin`, not `@vercel/react-router`.

Architecture constraint: Cloudflare's React Router integration currently does not support framework SPA mode or prerendering. This project accepts dynamic SSR plus deliberate edge caching. Reopen the framework decision before implementation if static prerendering becomes mandatory; TanStack Start supports it on Cloudflare.

## Expected configuration

The official scaffold should create or guide:

- `workers/app.ts` as the Worker entry;
- `wrangler.jsonc`;
- Cloudflare plugin registration in `vite.config.ts`;
- a React Router request handler with typed Cloudflare context;
- a Web Streams-compatible server entry with no Node `PassThrough`;
- generated Worker binding declarations.

The Vite plugin order is significant:

```ts
plugins: [
  cloudflare({ viteEnvironment: { name: "ssr" } }),
  reactRouter(),
  tsconfigPaths(),
]
```

Place the Cloudflare plugin before the React Router plugin.

Conceptual `wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "hyre-web",
  "main": "./workers/app.ts",
  "compatibility_date": "<deployment date>",
  "assets": {
    "directory": "./build/client"
  },
  "observability": {
    "enabled": true
  },
  "vars": {
    "API_ORIGIN": "https://<staging-or-production-api-host>",
    "APP_ORIGIN": "https://<web-host>"
  }
}
```

Use the compatibility settings emitted by the current official template. For new Workers with a compatibility date on or after 2026-08-04, Cloudflare enables current Node compatibility behavior by date and redundant flags may be omitted. Compatibility does not justify retaining filesystem, process-lifetime, TCP, Prisma, or PDFKit code.

## Environment and secrets

### Required web runtime configuration

- `API_ORIGIN` — Nest public origin, no trailing slash.
- `APP_ORIGIN` — canonical web origin.
- public Google Maps browser key, if still needed by UI.
- public Flutterwave key, if checkout requires it.
- observability DSN/token as required.
- maintenance/feature flags intentionally owned by web.

### Required web secrets

- `WEB_SESSION_SECRET` — web-owned encryption/integrity key for guest payment-flow state.

### Must not exist in the web Worker

- `DATABASE_URL`;
- Prisma/Neon credentials;
- Redis credentials used by Nest;
- Flutterwave secret/encryption/webhook keys;
- Twilio credentials;
- AWS secret keys;
- Resend/SMTP credentials;
- OpenAI/Anthropic secrets;
- FlightAware secret;
- Nest session secret.

Configure non-sensitive values as Worker vars and sensitive values with Cloudflare secrets. Do not commit `.dev.vars`.

Wrangler vars and secrets are non-inheritable. Define every required binding explicitly for each environment; do not assume production values flow into preview/staging.

Use separate Cloudflare environments or Workers for:

- local development -> local/staging Nest;
- pull-request preview -> staging Nest;
- production -> production Nest.

Never point untrusted preview deployments at production mutation endpoints.

## Suggested scripts

The final package scripts should cover:

```text
dev          run RR through the Cloudflare Vite runtime
build        production RR build
preview      run production build in local Workers runtime
deploy       build and deploy with Wrangler
cf-typegen   regenerate binding types
typecheck    RR typegen + Cloudflare typegen + TypeScript
lint
test
test:e2e
```

Remove:

- Prisma generation/migrations;
- Vercel build/start scripts;
- Mailpit/email-server startup;
- backend load-test scripts that target code no longer in web.

Database migrations remain a Nest deployment responsibility.

## Domains

Recommended:

```text
https://www.<domain> or https://<domain> -> Cloudflare Worker
https://api.<domain>                    -> Nest on Fly
```

Even with related custom domains, the BFF cookie relay remains necessary because production Better Auth uses host-only `__Host-` cookies.

Before deploying auth:

- add local, preview, and production web origins to Nest `TRUSTED_ORIGINS`;
- confirm Nest `AUTH_BASE_URL`;
- verify OTP callbacks and generated URLs;
- test forwarded `Origin`, role payload, and role-specific `Referer` behavior;
- confirm cookies are secure, host-only, and not exposed to JavaScript.

If `hyre-web` owns chauffeur airport-completion pages, add a dedicated canonical web-origin setting to Nest notification link generation. Do not use API `AUTH_BASE_URL` to generate web page links.

## Worker entry behavior

The entry should:

1. attach request ID/trace context;
2. delegate website requests to React Router;
3. register RR v8 instrumentation for requests, middleware, loaders, actions, navigations, and fetchers;
4. record matched route patterns and status without sensitive raw values;
5. propagate request/trace IDs to Nest;
6. apply security headers to HTML and data responses;
7. avoid becoming an unrestricted generic proxy;
8. expose no webhook or job handler duplicated from Nest.

Preview responses should be globally `noindex`. Production should noindex only private/API route groups, never the whole site.

If a same-origin `/api/*` proxy is introduced, use an allowlist and preserve:

- method and body streaming;
- query strings;
- abort signals;
- status/status text;
- content type;
- multiple `Set-Cookie` headers;
- safe cache behavior.

Prefer explicit loaders/actions over a broad proxy until a concrete browser API requirement exists.

Nest CORS currently allows only `Content-Type`, `Authorization`, and `Cookie`. Booking/payment/completion flows also use `Idempotency-Key`, `X-Payment-Status-Token`, and `X-Booking-Completion-Token`. Keep those calls server-to-server through the BFF, or expand Nest's CORS allowlist before any direct browser usage.

## Networking and placement

The Worker calls a regional Fly API, which then calls Neon. Edge execution does not remove backend latency.

Start with normal Workers placement and measure:

- Worker-to-Fly connection time;
- Nest processing time;
- total loader/action duration from Nigeria and target regions.

Evaluate Smart Placement only after measurements show it helps. Do not add Hyperdrive to `hyre-web`; the Worker does not connect to Neon.

## Caching and static assets

- Let Cloudflare serve fingerprinted build assets.
- Add explicit long-lived immutable headers for fingerprinted assets.
- Keep authenticated loader/action responses `private, no-store`.
- Keep authenticated RR data responses and every response involving cookies `private, no-store`.
- Do not cache Nest responses blindly at the Worker.
- Ensure any public cache key includes every response-varying query/header.
- Bypass cache for cookies, authorization, payments, availability, and user-scoped data.

## Uploads and downloads

Prefer:

- browser -> RR action -> Nest for small uploads; or
- browser -> presigned S3 upload issued by Nest for large files.

Do not buffer large uploads unnecessarily in the Worker.

Receipts/PDFs should be generated or served by Nest/object storage. The Worker may authorize and stream/redirect, but must not use the legacy PDFKit/filesystem implementation.

## CI/CD gates

For every pull request:

- install with a frozen lockfile;
- lint;
- typecheck including RR and Worker bindings;
- unit/contract tests;
- build;
- deploy preview against staging API;
- run smoke tests on preview;
- scan output for accidentally bundled server secrets or Node backend packages.

For production:

- verify Nest `GET /health`;
- verify configured origins;
- deploy Worker;
- run public/authenticated/payment smoke tests;
- verify metadata, robots, sitemap, CSP, and noindex;
- monitor upstream errors and auth failures.

## Rollback

Maintain:

- previous Worker deployment;
- previous DNS target or route;
- unchanged `hireApp` production deployment during migration;
- backward-compatible Nest endpoints through the observation window.

Rollback the web independently from Nest. Do not remove or change a shared endpoint until both mobile and the new web deployment are compatible.

## First deployment smoke test

```text
[ ] Home returns SSR HTML
[ ] Static assets load from Cloudflare
[ ] Public car search reaches staging Nest
[ ] Nest outage produces a controlled 503/error boundary
[ ] OTP request and verification work
[ ] Customer, fleet-owner, admin, and staff role payload/Referer rules work
[ ] Set-Cookie is stored for web origin
[ ] Multiple Set-Cookie headers survive login, refresh, and logout relay
[ ] Authenticated hard refresh renders user state on server
[ ] Logout clears every auth cookie
[ ] Unauthorized admin/fleet routes are blocked
[ ] No DATABASE_URL or backend secret exists in Worker settings
[ ] CSP and other security headers are present
[ ] robots/sitemap behavior matches environment
[ ] Guest booking retries reuse one idempotency key
[ ] Guest payment token remains HttpOnly and reaches Nest only as X-Payment-Status-Token
```
