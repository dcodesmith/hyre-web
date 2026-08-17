# Implementation skills and React effect policy

## Purpose

This review identifies agent skills that are sufficiently relevant and trusted
to guide the rebuild. Skills are development guidance, not application
dependencies or substitutes for framework documentation, linting, tests, or
code review.

The selection order is:

1. first-party maintainer authority;
2. applicability to React Router Framework Mode and this architecture;
3. security-audit status;
4. adoption and repository reputation;
5. freshness and installed-version awareness.

Install and repository counts below are a point-in-time signal observed on
2026-08-17 and will change.

## Baseline skills

### React Router

Use [`remix-run/react-router@react-router`](https://skills.sh/remix-run/react-router/react-router).

- First-party React Router source.
- Reads the installed package version and separates Framework, Data, and
  Declarative Mode guidance.
- 528 skill installs, a 56.6K-star source repository, and a passing Trust Hub
  audit at review time.
- Prefer this current skill over the older
  `remix-run/agent-skills@react-router-framework-mode` package despite the
  older package's higher historical install count.

```sh
npx skills add https://github.com/remix-run/react-router --skill react-router
```

Apply it to every route-module, loader/action, middleware, pending UI,
session, error-boundary, and rendering-strategy change.

### React implementation and performance

Use [`vercel-labs/agent-skills@vercel-react-best-practices`](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices).

- Maintained by Vercel Engineering.
- 638.6K installs, a 30.1K-star source repository, and a passing Trust Hub
  audit at review time.
- Its framework-neutral React rules cover waterfalls, bundle size, SSR,
  re-renders, deriving state without effects, and moving interaction logic
  from effects into event handlers.
- Ignore Next.js-only recommendations when they do not map to React Router or
  Cloudflare Workers.

```sh
npx skills add vercel-labs/agent-skills@vercel-react-best-practices
```

Apply it while implementing or reviewing React components and route data
flows.

### React quality gate

Use [`millionco/react-doctor@react-doctor`](https://skills.sh/millionco/react-doctor/react-doctor).

- 13K installs, a 14.4K-star source repository, and a passing Trust Hub audit
  at review time.
- Provides a repeatable post-change scan for correctness, architecture,
  performance, security, and accessibility regressions.

```sh
npx skills add millionco/react-doctor@react-doctor
```

Run `npx react-doctor@latest --verbose --scope changed` after substantive
React changes. Treat the result as an additional signal; typecheck, lint,
tests, and human review remain authoritative.

### Browser and parity testing

Use [`currents-dev/playwright-best-practices-skill@playwright-best-practices`](https://skills.sh/currents-dev/playwright-best-practices-skill/playwright-best-practices).

- 72.6K installs, a 356-star source repository, and a passing Trust Hub audit
  at review time.
- Covers stable locators, waiting, fixtures, authentication, responsive
  behavior, accessibility, visual regression, console errors, and CI.

```sh
npx skills add currents-dev/playwright-best-practices-skill@playwright-best-practices
```

Apply it when parity journeys begin. Prefer user-visible assertions and real
navigation over implementation-detail tests.

## Use when the relevant phase begins

- Use the first-party shadcn skill and current shadcn CLI documentation when
  establishing the component system. Do not select a community shadcn skill
  merely because it has more marketplace installs.
- Use Vercel's Web Interface Guidelines during UI and accessibility review.
  Fetch its current rules at review time rather than freezing a copy.
- Use official Cloudflare Workers and `@cloudflare/vite-plugin`
  documentation. The skill search found no first-party Cloudflare skill with
  authority comparable to the React Router and Vercel skills.

## Specialized `useEffect` finding

[`uinaf/agent-skills@react-ban-use-effect`](https://skills.sh/uinaf/agent-skills/react-ban-use-effect)
closely matches the desired policy and passed the Trust Hub audit. However, it
had only 138 installs and a four-star repository at review time, so it is not
trusted enough to make a mandatory baseline solely on popularity or provenance.

Its useful decision order has been incorporated into the target architecture:
derive during render, use framework data APIs, use event handlers/actions,
reset with keyed boundaries, use `useSyncExternalStore`, and reserve effects
for real external synchronization.

It may be installed as a focused review aid, but the repository must enforce
the policy mechanically:

```sh
npx skills add uinaf/agent-skills@react-ban-use-effect
```

- reject direct `useEffect` imports in routes and presentation components;
- allow effects only in reviewed integration-specific hooks;
- require the external system, setup, cleanup, and reactive inputs to be
  explicit;
- never allow an effect for server fetching, derived state, prop copying,
  event relaying, identity resets, or React Router pending UI.

## Deliberately not selected

- High-install authentication skills are not baseline React Router guidance;
  choose one only after the authentication implementation is confirmed.
- Broad community React-testing bundles add overlapping guidance without
  stronger provenance than the selected React and Playwright skills.
- Community Cloudflare, shadcn, and accessibility skills found in the search
  had weaker authority or adoption than the official documentation and tools
  already available.
- TanStack Router and TanStack Start skills do not apply to this React Router
  Framework Mode rebuild.

## Maintenance

- Review a skill's source before adding or updating it.
- Keep generated skill files and the skill lockfile together when the team
  decides to vendor skills.
- Re-run discovery before major phases because trust, ownership, and guidance
  can change.
- Do not let agent skills silently introduce dependencies or override the
  architecture decisions in this handover.
