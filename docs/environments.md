# Environments

`main` is the source branch for both deployed environments. Merging to `main`
updates development; it does not promote the web app to production.

| Web environment | Deployment | API origin |
| --- | --- | --- |
| Pull request | Cloudflare preview alias | Development API |
| Development | `hyre-web-development.tripdly.workers.dev` | `hyre-worker-nestjs.fly.dev` |
| Production | Dedicated production Cloudflare account; `tripdly.com` after cutover | `hyre-worker-nestjs-production.fly.dev` |

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

## One-time configuration

Repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`, identifying the non-production Cloudflare account
- `CLOUDFLARE_API_TOKEN`, with Workers Scripts Write access only in that account

GitHub environments:

- `development`
- `production`, with required reviewers, the
  `CLOUDFLARE_PRODUCTION_ACCOUNT_ID` and
  `CLOUDFLARE_PRODUCTION_API_TOKEN` environment secrets, and a
  `PRODUCTION_WORKER_ORIGIN` environment variable

Development/preview and production must use separate Cloudflare accounts.
Workers Scripts Write permission is account-scoped, not Worker-scoped, so
separate API tokens in one account do not isolate production. The production
account credentials must be available only through the protected GitHub
environment. Set `PRODUCTION_WORKER_ORIGIN` to the production account's
`workers.dev` URL before cutover, then to `https://tripdly.com` when its Worker
route becomes active.

Configure the web-owned session secret separately on each Cloudflare Worker:

```sh
pnpm exec wrangler secret put WEB_SESSION_SECRET --env development
pnpm exec wrangler secret put WEB_SESSION_SECRET --env production
```

Before enabling production traffic, add `https://tripdly.com` and the
development/preview Worker origins to the corresponding API
`TRUSTED_ORIGINS`. Configure the `tripdly.com` Worker route only during the
production cutover; until then the `workers.dev` URL can be used for validation.
