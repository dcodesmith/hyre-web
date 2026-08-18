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
The default local binding points to the Nest API at `http://127.0.0.1:3000`.
Copy `.dev.vars.example` to the uncommitted `.dev.vars` file and override
`API_ORIGIN` when using a different local API origin.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:bundle
pnpm preview
```

Husky runs `biome check --staged` before each commit. It rejects the commit if
staged files fail lint or format; it does not rewrite or restage files. Run
`pnpm lint:fix` to apply fixes, then restage. CI also runs `pnpm lint`, a
dedicated typecheck workflow, tests, and Snyk (high severity and above).
Dependabot updates npm weekly and GitHub Actions monthly.

## Deployment

Deployments use Wrangler. Preview and production bindings must be configured
separately and must never point an untrusted preview at production mutation
endpoints.

```sh
pnpm deploy
```

Pull requests from this repository upload a non-production Worker version and
run smoke checks against its aliased preview URL. Configure a protected GitHub
`preview` environment with:

- secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`;
- variables: `CLOUDFLARE_WORKERS_SUBDOMAIN`, `STAGING_API_ORIGIN`.

The staging API origin must be isolated from production mutation data. The
Worker must be deployed once before Wrangler can upload preview versions.
