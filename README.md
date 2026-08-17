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
pnpm dev
```

Your application will be available at `http://localhost:5173`.
The local Worker expects the Nest API at `http://127.0.0.1:3000`. Override
`API_ORIGIN` with an uncommitted `.dev.vars` file when using a different local
API origin.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

## Deployment

Deployments use Wrangler. Preview and production bindings must be configured
separately and must never point an untrusted preview at production mutation
endpoints.

```sh
pnpm deploy
```
