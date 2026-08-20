# BK-497: PAT capability-posture non-regression guard

| Field | Value |
|-------|-------|
| **Priority** | P0 (5 Critical, 2 High, 1 Medium, 1 High) |
| **Phase** | Standalone |
| **Items** | 9 TCs |
| **Dependencies** | None |
| **Requires** | `STAGING_USER_EMAIL`/`STAGING_USER_PASSWORD` (owner/admin-level test account, already used by `AuthApi`), live staging PAT-issuance endpoint, the `WORKSPACE_NOT_MEMBER_ID` fixture workspace already used by `switchActiveWorkspace.test.ts` |
| **Source** | Story: BK-497 |

## Summary

BK-497 made every API route handler declare its auth/capability posture explicitly via a new
discriminated union (`WithApiHandlerOptions` in `lib/api/handler.ts`), migrating all 85 gateway
call sites to the posture-declaring shape and lifting the hand-rolled `principal.via === 'bearer'`
rejection on the two token-mutation routes (`POST /api/v1/tokens`, `DELETE /api/v1/tokens/{id}`)
into the gateway as a first-class `cookie-only` posture. The dev's own DoD states **no behaviour
change** — AC-04/AC-05/AC-06 already passed before the migration and this Story is the *only* one
that touches all 87 call sites, so it is the only one that can silently break them. These 9 TCs are
**non-regression guards**, not new-feature tests: they lock in the capability-enforcement behaviour
(scope checks, workspace-binding checks, the `cookie-only` channel lift, and identity-resolution
ordering) so a future edit to the gateway or any of the 85 call sites cannot regress it unnoticed.

Two sibling Candidate TCs from the same test-documentation pass — BK-547 (TC-14, issue PAT from
Settings UI) and BK-549 (TC-15, revoked PAT rejected) — exist under the same Story but are **out of
scope** for this plan; only the 9 Jira keys named in this session's task are covered here.

## Preconditions

- A test user account exists in `staging` with credentials in `.env` (`STAGING_USER_EMAIL` /
  `STAGING_USER_PASSWORD`) — this account is the workspace **owner/admin** of at least one
  workspace (already the caller identity `AuthApi.authenticateSuccessfully()` establishes).
- A second, real workspace exists on staging that the test user is **not** a member of — the
  existing `WORKSPACE_NOT_MEMBER_ID = '047c106e-5334-4a80-8b66-d99ef4c474b4'` constant (`bunkai1-qa`,
  currently file-local to `tests/integration/workspace/switchActiveWorkspace.test.ts`) is reused for
  BK-551 and should be promoted to `tests/data/constants.ts` since it is now shared by 2 files.
- No runtime DB client exists in this framework (confirmed precedent: WS-T01's automation-plan.md
  §4, "no runtime DB client exists in this framework") — every "DB-confirmed" assertion in the
  Jira TC text is substituted with an equivalent API-level verification (see §Test Data Strategy
  in `automation-plan.md` §4 and each `atc/*.md` §8).

## Test Cases

### BK-544: should reject invite creation when the PAT is scoped only to atc:read

**Preconditions**: Caller holds a PAT scoped exactly `atc:read`, bound to the caller's own workspace, minted via `POST /api/v1/tokens` (session-authenticated).
**Action**: `POST /api/v1/workspaces/{workspace_id}/invites` using that PAT as Bearer auth.
**Expected Output**:
- Response status is 403
- Response message indicates the missing `workspace:admin` capability
- (Test-level) `GET /api/v1/workspaces/{workspace_id}/invites` (session-authenticated) shows no invite for the target email

```gherkin
@critical @regression @automation-candidate @BK-497
Scenario: BK-544 - should reject invite creation when the PAT is scoped only to atc:read
  Given a PAT exists scoped exactly to "atc:read" and bound to "{workspace_id}"
  When the user sends POST /api/v1/workspaces/{workspace_id}/invites using that PAT
  Then the response status is 403
  And the response indicates the missing "workspace:admin" capability
  And no workspace_invites row is created for the target email
```

---

### BK-548: should reject pending-invite revocation when the PAT lacks workspace:admin

**Preconditions**: Caller holds a PAT scoped `atc:write` + `run:execute` (no `workspace:admin`); a pre-existing pending invite exists in a workspace the PAT is bound to.
**Action**: `DELETE /api/v1/workspaces/{workspace_id}/invites/{invite_id}` using that PAT.
**Expected Output**:
- Response status is 403
- Response message indicates the missing `workspace:admin` capability
- (Test-level) `GET /api/v1/workspaces/{workspace_id}/invites` shows the invite's `revoked_at` still null

```gherkin
@critical @regression @automation-candidate @BK-497
Scenario: BK-548 - should reject pending-invite revocation when the PAT lacks workspace:admin
  Given a PAT exists scoped to "atc:write" and "run:execute" only, bound to "{workspace_id}"
  And a pending invite exists in "{workspace_id}"
  When the user sends DELETE /api/v1/workspaces/{workspace_id}/invites/{invite_id} using that PAT
  Then the response status is 403
  And the response indicates the missing "workspace:admin" capability
  And the invite's revoked_at remains null
```

---

### BK-550: should allow a workspace-admin action when the PAT is correctly scoped and bound to the target workspace

**Preconditions**: Caller holds a PAT scoped `workspace:admin`, bound to the target workspace.
**Action**: `PATCH /api/v1/workspaces/{workspace_id}` (no-op-equivalent name update) using that PAT.
**Expected Output**:
- Response status is 200
- Workspace reflects the update

```gherkin
@high @regression @automation-candidate @BK-497
Scenario: BK-550 - should allow a workspace-admin action when the PAT is correctly scoped and bound
  Given a PAT exists scoped to "workspace:admin" and bound to "{workspace_id}"
  When the user sends PATCH /api/v1/workspaces/{workspace_id} using that PAT
  Then the response status is 200
  And the workspace reflects the update
```

---

### BK-551: should reject a workspace-admin action when the PAT is bound to a different workspace

**Preconditions**: A PAT exists scoped `workspace:admin`, bound to workspace A; a second workspace B exists (`WORKSPACE_NOT_MEMBER_ID`).
**Action**: `PATCH /api/v1/workspaces/{workspace_b_id}` using the workspace-A-bound PAT.
**Expected Output**:
- Response status is 403
- Response message: "This token is scoped to a different workspace."

```gherkin
@critical @regression @automation-candidate @BK-497
Scenario: BK-551 - should reject a workspace-admin action when the PAT is bound to a different workspace
  Given a PAT exists scoped to "workspace:admin" and bound to "{workspace_a_id}"
  And a second workspace "{workspace_b_id}" exists
  When the user sends PATCH /api/v1/workspaces/{workspace_b_id} using that PAT
  Then the response status is 403
  And the response indicates the token is scoped to a different workspace
```

**Refinement note (carried from the TC)**: substitutes for the ATP's literal TC-03/AC-06
unresolvable-workspace scenario, which could not be live-reproduced (minting a PAT with no
resolvable workspace binding is blocked by design — `assertTokenIssuanceAuthorized`,
BK-135/ADR-0005). This TC exercises the sibling branch of the same guard (`assertWorkspaceContext`).

---

### BK-552: should reject a PAT-authenticated POST to the token-issuance route

**Preconditions**: Caller holds any valid minted PAT (rejection is channel-based, not scope-based).
**Action**: `POST /api/v1/tokens` using Bearer PAT auth.
**Expected Output**:
- Response status is 403
- Response message (verbatim): "Personal access tokens cannot issue tokens. Use a browser session."
- (Test-level) `GET /api/v1/tokens` (same PAT) shows no new token for the attempted name

```gherkin
@critical @regression @automation-candidate @BK-497
Scenario: BK-552 - should reject a PAT-authenticated POST to the token-issuance route
  Given a PAT exists with any valid scope
  When the user sends POST /api/v1/tokens using that PAT as Bearer auth
  Then the response status is 403
  And the response message is "Personal access tokens cannot issue tokens. Use a browser session."
  And no access_tokens row is created for the attempted name
```

---

### BK-553: should reject a PAT-authenticated DELETE to the token-revocation route

**Preconditions**: Caller holds any valid minted PAT; a target token exists to attempt revoking.
**Action**: `DELETE /api/v1/tokens/{token_id}` using Bearer PAT auth.
**Expected Output**:
- Response status is 403
- Response message (verbatim): "Personal access tokens cannot revoke tokens. Use a browser session."
- (Test-level) `GET /api/v1/tokens` (same PAT) shows target token's `revoked_at` still null

```gherkin
@critical @regression @automation-candidate @BK-497
Scenario: BK-553 - should reject a PAT-authenticated DELETE to the token-revocation route
  Given a PAT exists with any valid scope
  And a target access token exists (id {target_token_id})
  When the user sends DELETE /api/v1/tokens/{target_token_id} using the PAT as Bearer auth
  Then the response status is 403
  And the response message is "Personal access tokens cannot revoke tokens. Use a browser session."
  And the target token's revoked_at remains null
```

---

### BK-543: should allow a PAT-authenticated GET to the token-listing route

**Preconditions**: Caller holds any valid minted PAT (scope-irrelevant).
**Action**: `GET /api/v1/tokens` using that PAT as Bearer auth.
**Expected Output**:
- Response status is 200
- Response body lists the caller's tokens (RLS-scoped)
- Proves GET was NOT swept into the `cookie-only` lift (positive control)

```gherkin
@high @regression @automation-candidate @BK-497
Scenario: BK-543 - should allow a PAT-authenticated GET to the token-listing route
  Given a PAT exists with any valid scope
  When the user sends GET /api/v1/tokens using that PAT as Bearer auth
  Then the response status is 200
  And the response lists only the caller's own tokens
```

---

### BK-545: should allow session-authenticated calls to all three token routes given the cookie-only lift

**Preconditions**: Caller has an active staging session (cookie-authenticated, not Bearer).
**Action**: Issue a token, list tokens, and revoke a token — all via the session cookie, in sequence.
**Expected Output**:
- `POST /api/v1/tokens` returns 201
- `GET /api/v1/tokens` returns 200
- `DELETE /api/v1/tokens/{id}` returns 204
- All three routes behave exactly as before the `cookie-only` lift — session traffic unaffected

```gherkin
@critical @regression @automation-candidate @BK-497
Scenario: BK-545 - should allow session-authenticated calls to all three token routes
  Given the user has an active session (cookie-authenticated)
  When the user sends POST /api/v1/tokens using the session cookie
  Then the response status is 201
  When the user sends GET /api/v1/tokens using the session cookie
  Then the response status is 200
  When the user sends DELETE /api/v1/tokens/{issued_token_id} using the session cookie
  Then the response status is 204
```

**Multi-action note**: this TC chains 3 actions with intermediate expected results by TMS design
(single Jira Test issue, single Gherkin scenario). Implemented as ONE `@atc` with 3 embedded
`@step` helper calls (issue → list → revoke), mirroring the existing `AuthApi.authenticateSuccessfully`
pattern (ACTION + embedded VERIFICATION inside one ATC) rather than split into 3 ATCs, because the
TC's own identity is the *entire chain succeeding under cookie-only auth* — not 3 independent facts.

---

### BK-546: should return 401 for an invalid Bearer token before the cookie-only posture check runs

**Preconditions**: An invalid or malformed Bearer token string (never minted, or malformed).
**Action**: `POST /api/v1/tokens` using the invalid Bearer token.
**Expected Output**:
- Response status is 401 (NOT 403)
- Response message: "Invalid token."
- Proves `resolveIdentity` runs and fails BEFORE the `cookie-only` posture check (auth-resolution ordering the ACs are silent on — Error Guessing charter, not AC-derived)

```gherkin
@medium @regression @automation-candidate @BK-497
Scenario: BK-546 - should return 401 for an invalid Bearer token before the cookie-only posture check runs
  Given an invalid or malformed Bearer token
  When the user sends POST /api/v1/tokens using that invalid token
  Then the response status is 401
  And the response message is "Invalid token."
```

---

## Merged TCs (if any)

None.

## Updated TCs (if any)

None — all 9 TCs consumed verbatim from the test-documentation pass (Jira `Test` issues, `In Design` status). No spec-level corrections were needed against `implementation-plan.md`.

## Acceptance Criteria

- [ ] 9 TCs automated across 2 components (`TokensApi` new, `WorkspaceApi` extended) with the
      Discover-first / mint-a-scoped-PAT-as-precondition pattern
- [ ] Tests pass on staging (this Story has no local-env-specific behaviour)
- [ ] Every "DB-confirmed" assertion in the original Jira TC text is substituted with an equivalent
      API-level verification (no runtime DB client in this framework — see automation-plan.md §4)
