# BK-3: Sign up and sign in via OAuth (GitHub / Google)
**Ticket:** BK-3 | **Module:** tenancy-identity | **Status:** Shift-Left QA | **Sprint:** n/a — pre-sprint

## Acceptance Criteria (original)

The story provides a workflow and business rules but no formal numbered ACs. The following are derived from the story description:

- AC1: Visitor can initiate OAuth sign-in with GitHub provider from the login page.
- AC2: Visitor can initiate OAuth sign-in with Google provider from the login page.
- AC3: OAuth state token must be validated server-side; mismatch returns 403.
- AC4: OAuth-only users have no password and cannot use email magic-link as alternate sign-in (MVP; linking deferred to Phase 2).
- AC5: If the same verified email already exists under a different OAuth provider, the second attempt is rejected with `EMAIL_EXISTS` error code (manual linking by support in MVP).
- AC6: On successful first login, a default workspace is created and a session cookie is set; user is redirected to `/home`.
- AC7: On any OAuth failure, the user is redirected to `/login` with an error code and a magic-link fallback CTA visible.

## Team Discussion (from comments)
No team discussions found.

## Parent epic
BK-1: Tenancy & Identity

## Pre-sprint status
Shift-Left refinement: in progress (started 2026-05-26)
