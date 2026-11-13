# ADR-0026 — Two auth rails in tests: browser storage state for UI, per-role API tokens for API

- **Status:** Accepted
- **Date:** 2026-11-13
- **Deciders:** QA lead (Luis Flores), approved in the project-discovery review of 2026-11-13 (session bunkai-qa-engineering-f6). Discovered, not designed, in that session.
- **Tags:** auth-in-tests, fixtures
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Bunkai authenticates browsers with the Supabase SSR session cookie and machines with `bk_pat_*` Bearer tokens. Some routes are cookie-only, and a PAT cannot mint a PAT (`bun run context:map infra-context --section architecture`, `--section backend`). This repo already wires the two rails: the `ui-setup` project produces the browser storage state used by `e2e` and `smoke-ui`; the `api-setup` project and `bun run api:login --role <role>` produce per-role tokens used by `integration` and `smoke-api`. The decision was found in `playwright.config.ts`, `tests/setup/*.setup.ts` and `scripts/api-login.ts` during project-discovery; it was not designed there.

## Decision

We will authenticate UI tests once per run through `ui-setup` and reuse the storage state, and API tests with tokens from `api-setup` / `api:login`, one identity per role (owner, member, viewer, non-member). Tests of admin-scoped token routes use a cookie session, never a PAT.

## Consequences

- **Positive:** no login inside individual tests; the role under test is explicit.
- **Negative / trade-offs:** an expired token or storage state fails many tests at once; every role needs a real identity in staging, and there is no admin identity yet.
- **Neutral / follow-ups:** changing the model touches every fixture; provisioning an admin test identity is an open item.

## Alternatives considered

- **Log in through the UI in every test**: slow and flaky.
- **PAT for everything**: cannot cover cookie-only routes.

## References

- `bun run context:map infra-context --section backend` (auth requests), `bun run context:map business-api-context --section auth-model`
- `playwright.config.ts`, `tests/setup/`, `scripts/api-login.ts`
