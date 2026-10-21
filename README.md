# Tripdly Web

Tripdly's web app serves customers, fleet owners, chauffeurs, and admins. It is
a React Router v8 server-rendered application running on Cloudflare Workers.

## What this repo owns

The app provides these broad feature groups:

- customer discovery, booking, payment, account, and referral flows;
- fleet-owner operations for bookings, vehicles, chauffeurs, promotions, and payouts;
- chauffeur onboarding;
- admin operations and public content.

React Router loaders and actions call the API through server-only adapters in
`app/api`. The API, `hyre-worker-nestjs`, owns business data and rules; the
native customer app lives in `hyre-mobile`.

For the browser-to-API boundary, see
[the target architecture](docs/handover/01-ARCHITECTURE.md). For the live code
layout and dependency rules, see
[the app structure](docs/handover/06-APP-STRUCTURE.md). The broader handover
index is a planning baseline; its "Current repository warning" describes an
earlier checkout, not the current tree.

## Requirements

- Node.js 22.22.0 (`package.json` supports `>=22.22.0 <23`)
- pnpm 10.20.0

## Local development

```sh
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev
```

The app is available at `http://localhost:5173`. By default it calls the API at
`http://127.0.0.1:3000`.

`.dev.vars.example` documents the four local bindings:

- `API_ORIGIN`
- `APP_ENV`
- `APP_ORIGIN`
- `WEB_SESSION_SECRET`

Generate a unique local `WEB_SESSION_SECRET`; the example intentionally leaves
it empty. Deployed non-secret values are defined by environment in
`wrangler.jsonc`, while the session secret is configured separately for each
Worker.

## Contributor commands

- `pnpm lint`, `pnpm lint:fix`, `pnpm format` — check or update code style
- `pnpm typecheck` — generate Worker and route types, then run TypeScript
- `pnpm test`, `pnpm test:e2e` — run unit/integration or Playwright tests
- `pnpm build`, `pnpm check:bundle` — build and validate the Worker bundle
- `pnpm preview` — build and start a local Vite preview
- `pnpm deploy` — build, validate, and deploy the development Worker

Husky runs `biome check --staged` before each commit. It rejects staged files
that fail checks without rewriting or restaging them. Pull-request and `main`
workflows run linting, type checks, tests, builds, bundle checks, Playwright
tests, and a high-severity dependency audit.

## Deployment

Deployments use Wrangler environments. Pull requests upload preview Worker
versions and smoke-test their aliased URLs. Merges to `main` deploy the
long-lived development Worker. Production is deployed manually through an
approval-gated GitHub workflow, so merging to `main` does not deploy
production.

See [docs/environments.md](docs/environments.md) for environment mappings,
one-time setup, secrets, and the production release procedure.
