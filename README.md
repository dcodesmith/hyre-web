# Hyre Web

React Router v8 framework-mode application running with SSR in the Cloudflare
Workers runtime.

The migration architecture and delivery plan are documented under
[`docs/handover`](./docs/handover/README.md).

## Requirements

- Node.js 22.22 or newer in the Node 22 release line
- pnpm 10.20

## Development

```sh
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev
```

Your application will be available at `http://localhost:5173`.
The example local binding points to the Nest API at `http://127.0.0.1:3000`.
Override `API_ORIGIN` in the uncommitted `.dev.vars` file when using a different
local API origin.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

Husky runs Biome on staged TypeScript and JSON files before each commit. CI also
runs `pnpm lint`, a dedicated typecheck workflow, tests, and Snyk (high
severity and above). Dependabot updates npm weekly and GitHub Actions monthly.

## Deployment

Deployments use Wrangler. Preview and production bindings must be configured
separately and must never point an untrusted preview at production mutation
endpoints.

```sh
pnpm deploy
```
