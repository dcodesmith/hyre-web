# Environments

`main` is the source branch for both deployed environments. Merging to `main`
updates development; it does not promote the web app to production.

| Web environment | Deployment | API origin |
| --- | --- | --- |
| Pull request | Cloudflare preview alias | Development API |
| Development | `hyre-web-development.tripdly.workers.dev` | `hyre-worker-nestjs.fly.dev` |
| Production | `hyre-web-production` in the existing Cloudflare account; `tripdly.com` after cutover | `hyre-worker-nestjs-production.fly.dev` |

PR previews intentionally share the development API. A web PR is not paired
with an API PR database because PR numbers and lifecycles are independent
across repositories.

## Development

Every push to `main` runs `.github/workflows/deploy-development.yml`. It runs
the quality gates, deploys the Cloudflare `development` environment, and smoke
tests both the Worker and the development API. The deployment is non-indexable
and uncached.

## Production

Run the **Deploy Production** GitHub workflow manually with:

- `ref`: a commit, branch, or tag already contained in `main`;
- `version`: a new stable semantic version such as `v1.0.0`.

The workflow verifies the candidate, waits for approval from the protected
GitHub `production` environment, deploys and smoke tests the production
Worker, then creates the GitHub release. A failed deployment or smoke test
does not create a version tag. The first production release is `v1.0.0`.

Promote the production API before the web app so the target API and database
are healthy before web traffic moves.

## Deployment metadata

Worker-handled responses identify the exact web revision through
`X-App-Version` and `X-Commit-SHA` headers:

- pull request previews use `pr-<number>-<short-sha>`;
- development uses `dev-<short-sha>`;
- production uses the validated release version, such as `v1.0.0`.

Web and API versions remain independent. These headers identify the running
web deployment; they do not pin it to a specific API release. Deployment smoke
tests verify both headers against the commit and version selected by the
workflow. Static assets may bypass the Worker and therefore do not carry these
headers.

## One-time configuration

Repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`, identifying the existing shared Cloudflare account
- `CLOUDFLARE_API_TOKEN`, used by preview and development deployments

GitHub environments:

- `development`
- `production`, with required reviewers, a
  `CLOUDFLARE_PRODUCTION_API_TOKEN` environment secret, and a
  `PRODUCTION_WORKER_ORIGIN` environment variable

Development and production use Wrangler environments in the same Cloudflare
account. Cloudflare deploys them as distinct Workers:
`hyre-web-development` and `hyre-web-production`. Their variables, bindings,
routes, and runtime secrets are configured independently, following
[Cloudflare's environments guidance](https://developers.cloudflare.com/workers/wrangler/environments/).

Use separate API tokens for development and production so they can be stored,
rotated, and revoked independently. Keep the production token available only
through the protected GitHub environment. Cloudflare's Workers Scripts Write
permission is account-scoped rather than Worker-scoped, so these tokens provide
operational separation but not a strict authorization boundary between Workers
in the account. A separate Cloudflare account would only be necessary if that
hard boundary becomes a requirement.

Set `PRODUCTION_WORKER_ORIGIN` to the production Worker's `workers.dev` URL
before cutover, then to `https://tripdly.com` when its route becomes active.

Configure the web-owned session secret separately on each Cloudflare Worker:

```sh
pnpm exec wrangler secret put WEB_SESSION_SECRET --env development
pnpm exec wrangler secret put WEB_SESSION_SECRET --env production
```

Before enabling production traffic, add `https://tripdly.com` and the
development/preview Worker origins to the corresponding API
`TRUSTED_ORIGINS`. Configure the `tripdly.com` Worker route only during the
production cutover; until then the `workers.dev` URL can be used for validation.
