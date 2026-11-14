# ADR-0029 — Cached per-identity auth: one sign-in per role per run, tests switch actor locally

- **Status:** Accepted
- **Date:** 2026-11-14
- **Deciders:** QA lead (Luis Flores). Approach approved 2026-11-13 (session bunkai-qa-engineering-f6), plan approved 2026-11-14 (session bunkai-qa-engineering-1f).
- **Tags:** auth-in-tests, fixtures, throttle
- **Supersedes:** —
- **Superseded by:** —

---

## Context

BK-1828 added a sign-in throttle to `/auth/signin` and `/auth/confirm` on staging: 10 attempts per account per 15 min, 10 per network source per 60 s, 60 per network source per hour. Every attempt counts, including failures, and a 429 carries `Retry-After`. The integration suite signed in inside individual tests (`authenticateAs` / `authenticateSuccessfully`), about 72 sign-ins per run, about 63 of them as the owner. The first scheduled runs after the throttle went live (2026-11-14) failed every test after roughly the tenth owner sign-in with a 429. ADR-0026 already stated "no login inside individual tests" as the intent; the API rail did not honour it.

## Decision

We will sign each role (owner, member, viewer, non-member) in exactly once per run, in the `api-setup` project, each in its own fresh request context, and cache its PAT plus its session cookies in `.auth/identities/<role>.json`. Tests switch actor with `useIdentity(api, role, { withSession })` from `@utils/auth`, which makes no network call: it sets the role's PAT and always clears the request cookies, then loads the role's cookies only when `withSession` is set. A role without credentials for the current TEST_ENV is cached as unprovisioned and its specs skip (`isIdentityProvisioned`); a role with credentials whose sign-in fails fails the setup, like the owner. The owner identity is mirrored to `.auth/api-state.json`, so the `api` fixture and `scripts/api-login.ts` keep working. Only tests whose subject IS sign-in perform a real sign-in.

## Consequences

- **Positive:** one sign-in per role per run plus the tests whose subject is sign-in, instead of one per test (about 72 per run before); the suite stays under every throttle budget; tests run faster.
- **Negative / trade-offs:** tests of one role share one server-side session, so a test that signs the shared session out or revokes the cached PAT would break later tests of that role, so such a test must use its own sign-in instead of the cached identity; the active workspace is a client cookie (`bk_active_ws`) scoped to each test's own request context, so switching it does not leak. A cached cookie goes stale once its access token expires (about 1 h); a long local session reruns `api-setup`. A member, viewer or nonMember sign-in failure fails `api-setup` and therefore skips every API test, including owner-only ones. A run longer than about 55 minutes after `api-setup` (e.g. a local all-projects run on one worker) makes `withSession` tests fail with the expiry error; run `--project=integration` on its own.
- **Neutral / follow-ups:** cookies are opt-in per call, never ambient, so an "unauthenticated" assertion cannot pass on a leftover cookie. `authenticateAs` is removed. `useIdentity` refuses a cache minted for another API URL or a session within 5 minutes of its expiry (Supabase refreshes about 90 s before expiry and rotates the refresh token, which the cache never sees), telling the reader to rerun `api-setup`. Allure attachments redact passwords and tokens (the report is public). Playwright traces are off for the API projects everywhere and for every project in CI, because traces record raw auth headers and typed passwords; UI traces stay local-only (`retain-on-failure`). Setup PATs carry a 1-day lifetime (`pat_expires_in_days: 1`).

## Alternatives considered

- **Retry on 429 honouring `Retry-After`**: runs would take hours, and it hides the problem.
- **Long-lived PATs in CI secrets**: cannot cover cookie-only routes (ADR-0026).

## References

- ADR-0026 (two auth rails; this ADR implements its API-rail consequence)
- `.context/PBI/defects/DEFECT-BK-1828-*/`
- `tests/setup/api-auth.setup.ts`, `tests/utils/auth.ts`, `config/variables.ts`
