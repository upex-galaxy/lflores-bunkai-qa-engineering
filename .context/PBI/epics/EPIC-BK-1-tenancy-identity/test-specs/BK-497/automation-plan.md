# Test Automation Plan: BK-497

> Ticket: BK-497 — PAT | Require every API route to declare its capability posture
> Type: integration (all 9 TCs — pure API, no UI)
> Sprint: n/a (post-Stage-4 automation pass)
> Created: 2026-08-20

## 1. Ticket Summary

- What to test: the capability-posture enforcement introduced by BK-497's `WithApiHandlerOptions`
  discriminated union — PAT scope checks on workspace-admin actions (invites, workspace PATCH),
  the `cookie-only` channel lift on the two token-mutation routes, the GET-exception that keeps
  token-listing Bearer-accessible, and the identity-resolution-before-posture-check ordering.
- Acceptance Criteria: AC-04 / AC-05 / AC-06 (non-regression guards — already pass against
  today's code per the dev's `implementation-plan.md` §Test strategy; these 9 TCs exist to catch a
  *future* regression on the all-87-call-site migration, not to prove new behaviour).
- Dependencies: none. Builds on 2 existing ATCs (`AuthApi.authenticateSuccessfully` BK-311,
  `WorkspaceApi` module) already in `kata-manifest.json`.

## 2. Architecture Decisions

### Component Strategy

| Decision | Value | Rationale |
|---|---|---|
| Component (new) | `TokensApi.ts` | No existing component owns `/api/v1/tokens*` — confirmed against `kata-manifest.json` (5 components: `AuthApi`, `BugsApi`, `NotificationsApi`, `WorkspaceApi`, `LoginPage`; none cover Tokens/PAT). Owns 5 ATCs (BK-552, BK-553, BK-543, BK-545, BK-546) + 4 helpers. |
| Component (extend) | `WorkspaceApi.ts` | Already owns `/api/v1/workspaces*`-adjacent territory (`/me/active-workspace`) and the cookie-suspend/restore pattern this plan reuses (`postActiveWorkspace`). Adds 4 ATCs (BK-544, BK-548, BK-550, BK-551) + 2 helpers. |
| Fixture | `{ api }` | All 9 TCs are pure API, no UI element involved — confirmed by every TC's own "N/A — API-level test, no UI selectors." |
| Test files | 4 files across 2 module dirs — see §5 | verb+Feature naming (rule #15); grouped by component + flow family, mirroring WS-T01's own rationale ("one file for TCs that share the same component and flow family") |
| Preconditions | Inline in test body / `beforeEach`, no Steps module | Only 9 ATCs total across 2 components — below the "3+ ATCs repeated across 3+ files" Steps threshold. The one genuinely cross-cutting precondition (mint a scoped PAT) stays a `@step` helper on `TokensApi`, called from `WorkspaceApi` test files at the TEST level (not component-to-component), matching the ATC rule "preconditions received via parameters, not internal setup." |

### [INTEGRATION] API Details

| Aspect | Value |
|---|---|
| Endpoints | `POST/GET /api/v1/tokens`, `DELETE /api/v1/tokens/{id}` (TokensApi); `PATCH /api/v1/workspaces/{id}`, `POST/DELETE /api/v1/workspaces/{id}/invites[/{inviteId}]`, `GET /api/v1/workspaces/{id}/invites` (WorkspaceApi additions) |
| OpenAPI Type(s) | New facade `api/schemas/tokens.types.ts` (`CreateTokenBody`, `CreateTokenResponse`, `ListTokensResponse`, `TokenSummary`) wired to `paths['/api/v1/tokens']` / `paths['/api/v1/tokens/{id}']`. Extend existing `api/schemas/workspace.types.ts` with `WorkspacePatchBody`, `WorkspaceResponse`, `Workspace`, `WorkspaceInviteCreateBody`, `WorkspaceInviteCreateResponse`, `WorkspaceInviteListResponse`, `WorkspaceInvite`, all already present in `api/openapi.json`/`api/openapi-types.ts` — **no `bun run api:sync` needed**, the spec is current for every endpoint this plan touches. |
| Auth Required | Yes, on every route. Auth CHANNEL is the variable under test (Bearer PAT vs session cookie vs invalid Bearer) — this is the core thing BK-497 changed. |
| Return Pattern | Tuple `[APIResponse, TBody]` (GET/DELETE) or `[APIResponse, TBody, TPayload]` (POST/PATCH), per KATA convention — except `BK-545` (`allowSessionAuthenticatedTokenLifecycle`), which is a deliberate 3-action embedded-verification ATC and returns `[APIResponse, APIResponse, APIResponse]` (issue, list, revoke) — see `atc/BK-545-*.md` §2. |

**OpenAPI documentation gap (non-blocking)**: `api/openapi.json`'s `security` block for `GET /api/v1/tokens` lists only `cookieAuth`, but the dev's `implementation-plan.md` §1 explicitly keeps GET on `{ auth: 'authenticated' }` (Bearer OR cookie, no capability check) — BK-543 exists specifically to prove Bearer still works on GET. This is stale `security` metadata only; it does not affect the generated TypeScript types (paths/schemas are correct), so it does not block automation. Flagging for a follow-up doc fix, not a plan blocker.

## 3. ATC Registry

### Existing ATCs (Reuse)

| ATC ID | Component | Method | Description |
|---|---|---|---|
| BK-311 | `AuthApi` | `authenticateSuccessfully` | Establishes a fresh session (Bearer PAT + session cookie, both land in the shared `APIRequestContext` cookie jar) — precondition for every TC that needs to mint a scoped PAT or exercise the cookie-only channel |
| — | `AuthApi` | `getCurrentUser` (`@step`, no `@atc`) | Discovers the caller's own `active_workspace_id` — precondition for BK-544/548/550 (workspace A) |

### New ATCs (Create)

| ATC ID | Component | Method | Description |
|---|---|---|---|
| BK-552 | `TokensApi` | `rejectPatPostTokenIssuance` | PAT-authenticated POST /tokens → 403, verbatim message, no row created |
| BK-553 | `TokensApi` | `rejectPatDeleteTokenRevocation` | PAT-authenticated DELETE /tokens/{id} → 403, verbatim message, target unchanged |
| BK-543 | `TokensApi` | `allowPatGetTokenListing` | PAT-authenticated GET /tokens → 200 (positive control, GET not swept into the lift) |
| BK-545 | `TokensApi` | `allowSessionAuthenticatedTokenLifecycle` | Session-cookie issue→list→revoke chain → 201/200/204, all 3 routes unaffected by the lift |
| BK-546 | `TokensApi` | `rejectInvalidBearerBeforePostureCheck` | Invalid Bearer POST /tokens → 401 (not 403) — proves identity resolution runs first |
| BK-544 | `WorkspaceApi` | `rejectInviteCreationWithReadOnlyPat` | `atc:read`-only PAT POST /invites → 403, missing-capability message |
| BK-548 | `WorkspaceApi` | `rejectRevokeInviteWithoutAdminScope` | `atc:write`+`run:execute` PAT DELETE /invites/{id} → 403, missing-capability message |
| BK-550 | `WorkspaceApi` | `allowWorkspaceAdminActionWithBoundPat` | `workspace:admin`-scoped + bound PAT PATCH /workspaces/{id} → 200 (positive control) |
| BK-551 | `WorkspaceApi` | `rejectCrossWorkspaceAdminPat` | `workspace:admin` PAT bound to workspace A, PATCH workspace B → 403, wrong-workspace message |

### New Helpers (No @atc)

| Component | Method | Returns | Description |
|---|---|---|---|
| `TokensApi` | `issueToken(body)` (`@step`) | `[APIResponse, CreateTokenResponse, CreateTokenBody]` | Raw POST /tokens wrapper. Reused by `mintPatWithScopes` (Bearer-cleared) and directly by `BK-545`'s embedded issue step (already Bearer-cleared by the test precondition) |
| `TokensApi` | `listTokens()` (`@step`) | `[APIResponse, ListTokensResponse]` | Raw GET /tokens wrapper. Reused as the verification step for BK-552/553's "no row created" / "target unchanged" test-level assertions, and as BK-545's embedded list step |
| `TokensApi` | `revokeToken(tokenId)` (`@step`) | `[APIResponse, Record<string, unknown>]` | Raw DELETE /tokens/{id} wrapper. Reused by BK-545's embedded revoke step |
| `TokensApi` | `mintPatWithScopes(overrides)` (`@step`) | `CreateTokenResponse` | THE shared precondition helper. Saves `this.authToken`, clears it (forces cookie-only auth on the shared `APIRequestContext`), calls `issueToken`, restores the saved Bearer. Requires a session cookie already present in the context (established by a prior `api.auth.authenticateSuccessfully()` call in the same test) |
| `WorkspaceApi` | `getWorkspaceInvites(workspaceId)` (`@step`) | `[APIResponse, WorkspaceInviteListResponse]` | GET /workspaces/{id}/invites wrapper. Reused as the test-level verification step for BK-544 ("no invite created") and BK-548 ("revoked_at still null") |
| `WorkspaceApi` | `createWorkspaceInvite(args)` (`@step`) | `[APIResponse, WorkspaceInviteCreateResponse, WorkspaceInviteCreateBody]` | POST /workspaces/{id}/invites wrapper, called with the OWNER session/PAT (not the restricted one under test) — precondition for BK-548's "pre-existing pending invite" |

## 4. Test Data Strategy

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Fresh session (cookie + default PAT) for every TC that needs a scoped PAT | **Generate** | `api.auth.authenticateSuccessfully(credentials)` — mints a session + default PAT as a side effect; unavoidable since it's the only way to get a session cookie into the `integration` project's `APIRequestContext` (confirmed: `playwright.config.ts` sets `use: {}` for `integration`, no `storageState`, so no cookie is preloaded from `api-auth.setup.ts`, which only persists the Bearer token to `api-state.json`) | `beforeEach`, every test (mutating — each test needs its own fresh cookie) | None — session/default-PAT leak accepted (disposable staging env, same pattern already implicit in every existing `AuthApi.authenticateSuccessfully()` call site) |
| Scoped/bound PAT (BK-544 `atc:read`, BK-548 `atc:write`+`run:execute`, BK-550/551 `workspace:admin`, BK-552/553/543 any scope) | **Generate** | `api.tokens.mintPatWithScopes({ scopes, workspace_id?, name })` | `beforeEach`, after the fresh-session step, per test | **Recommended, not mandatory**: revoke via `api.tokens.revokeToken(id)` (session-authenticated) in `afterEach` to avoid unbounded PAT accumulation on the shared staging tenant. Flagged as a Code-phase decision, not a plan blocker — see Risks. |
| Caller's own workspace (`workspace_id` for BK-544/548/550) | **Discover** | `api.auth.getCurrentUser()` → `active_workspace_id` (existing `@step` helper, same pattern as WS-T01) | Test body, before minting the bound PAT | None — read-only |
| Second workspace, not the caller's (`workspace_b_id` for BK-551) | **Discover (design-time, hardcoded constant)** | Reuses `WORKSPACE_NOT_MEMBER_ID = '047c106e-5334-4a80-8b66-d99ef4c474b4'` (`bunkai1-qa`) — already live on staging, already established by WS-T01 (`switchActiveWorkspace.test.ts`) for the identical "real workspace, not a member" need. No runtime DB client exists in this framework (WS-T01 precedent), so a fresh per-run DB `SELECT` is not an option; a Generate-a-whole-new-workspace path was already rejected as disproportionate for the equivalent BK-251 case | Constant, promoted to `tests/data/constants.ts` (now used by 2 files — extraction threshold met) | None — read-only |
| Pre-existing pending invite (BK-548) | **Generate** | `api.workspace.createWorkspaceInvite({ workspaceId, body: { email: faker-generated, role: 'member' } })`, called with the OWNER session (before swapping to the restricted PAT) | `beforeEach`, per test (fresh invite avoids order dependencies) | Optional: `DELETE /invites/{id}` via owner session in `afterEach`; low urgency since a pending invite is harmless leaked state |
| Target token to attempt-revoke (BK-553) | **Generate** | A second `mintPatWithScopes(...)` call, distinct from the acting PAT | `beforeEach`, per test | Same as scoped-PAT row above |
| Invalid/malformed Bearer token (BK-546) | **N/A — static constant** | New `INVALID_BEARER_TOKEN` constant in `tests/data/constants.ts` (deliberately-invalid literal, e.g. `'bk_pat_invalid.does-not-exist-00000000'`) — determinism preferred over `faker` randomness since the value's specific shape doesn't matter, only that it never resolves | Constant | N/A |

Nothing in this plan needs a DB client or DB-level assertion — every "DB-confirmed" claim in the
original Jira TC text is substituted with an equivalent API-level read (`GET /api/v1/tokens` or
`GET /api/v1/workspaces/{id}/invites`), per the no-runtime-DB-client constraint already established
by WS-T01.

### DataFactory / Constants additions

```typescript
// tests/data/constants.ts
export const WORKSPACE_NOT_MEMBER_ID = '047c106e-5334-4a80-8b66-d99ef4c474b4'; // bunkai1-qa — promoted from switchActiveWorkspace.test.ts (now shared by 2 files)
export const INVALID_BEARER_TOKEN = 'bk_pat_invalid.does-not-exist-00000000'; // syntactically PAT-shaped, never minted — BK-546
```

No `DataFactory.ts` generator additions needed — `mintPatWithScopes`'s `name` field can use the
existing `this.data.createTestId('pat')` pattern already used elsewhere in the codebase, no new
typed factory required.

## 5. Test Scenarios

### File: `tests/integration/tokens/enforceTokenRouteCookieOnlyPosture.test.ts`

Fixture: `{ api }`

#### Scenario 1 (BK-552)
Test: `"BK-497: should reject a PAT-authenticated POST to the token-issuance route"`
Preconditions: `authenticateSuccessfully()`; `tokens.mintPatWithScopes({ scopes: ['atc:read'] })`; set as ambient `tokens.authToken`.
ATCs called: `TokensApi.rejectPatPostTokenIssuance()`
Test-level assertions: `tokens.listTokens()` (same PAT) contains no token named the attempted name.
Teardown: none — 403 rejected before any mutation.

#### Scenario 2 (BK-553)
Test: `"BK-497: should reject a PAT-authenticated DELETE to the token-revocation route"`
Preconditions: `authenticateSuccessfully()`; mint acting PAT + target PAT (2x `mintPatWithScopes`); set acting PAT as ambient `tokens.authToken`.
ATCs called: `TokensApi.rejectPatDeleteTokenRevocation(targetTokenId)`
Test-level assertions: `tokens.listTokens()` shows target's `revoked_at === null`.
Teardown: none — 403 rejected before any mutation.

#### Scenario 3 (BK-543)
Test: `"BK-497: should allow a PAT-authenticated GET to the token-listing route"`
Preconditions: `authenticateSuccessfully()`; `tokens.mintPatWithScopes({ scopes: ['atc:read'] })`; set as ambient `tokens.authToken`.
ATCs called: `TokensApi.allowPatGetTokenListing()`
Test-level assertions: none beyond the ATC's own fixed assertions (positive control, single call).
Teardown: none.

#### Scenario 4 (BK-546)
Test: `"BK-497: should return 401 for an invalid Bearer token before the cookie-only posture check runs"`
Preconditions: none (no valid session/PAT needed) — `tokens.setAuthToken(INVALID_BEARER_TOKEN)`.
ATCs called: `TokensApi.rejectInvalidBearerBeforePostureCheck()`
Test-level assertions: none beyond the ATC's own fixed assertions.
Teardown: none.

### File: `tests/integration/tokens/allowSessionTokenLifecycleUnaffectedByLift.test.ts`

Fixture: `{ api }`

#### Scenario 5 (BK-545)
Test: `"BK-497: should allow session-authenticated calls to all three token routes given the cookie-only lift"`
Preconditions: `authenticateSuccessfully()`; `tokens.clearAuthToken()` (force cookie-only for the whole chain).
ATCs called: `TokensApi.allowSessionAuthenticatedTokenLifecycle(body)` (embeds issue→list→revoke).
Test-level assertions: the revoked token's id (returned from the issue step) matches the id passed to the embedded revoke step — cross-step consistency check.
Teardown: none — the ATC's own revoke step is the cleanup.

### File: `tests/integration/workspace/enforceInviteCapabilityScope.test.ts`

Fixture: `{ api }`

#### Scenario 6 (BK-544)
Test: `"BK-497: should reject invite creation when the PAT is scoped only to atc:read"`
Preconditions: `authenticateSuccessfully()`; discover `workspace_id` via `auth.getCurrentUser()`; `tokens.mintPatWithScopes({ scopes: ['atc:read'], workspace_id })`; set as ambient `workspace.authToken`.
ATCs called: `WorkspaceApi.rejectInviteCreationWithReadOnlyPat({ workspaceId, invite })`
Test-level assertions: `workspace.getWorkspaceInvites(workspaceId)` (owner session, restored) shows no invite for the target email.
Teardown: none — 403 rejected before any mutation.

#### Scenario 7 (BK-548)
Test: `"BK-497: should reject pending-invite revocation when the PAT lacks workspace:admin"`
Preconditions: `authenticateSuccessfully()`; discover `workspace_id`; `workspace.createWorkspaceInvite(...)` (owner session) → `invite_id`; `tokens.mintPatWithScopes({ scopes: ['atc:write','run:execute'], workspace_id })`; set as ambient `workspace.authToken`.
ATCs called: `WorkspaceApi.rejectRevokeInviteWithoutAdminScope({ workspaceId, inviteId })`
Test-level assertions: `workspace.getWorkspaceInvites(workspaceId)` (owner session, restored) shows the invite's `revoked_at === null`.
Teardown: optional — delete the generated invite via owner session.

### File: `tests/integration/workspace/enforceWorkspaceAdminCapabilityScope.test.ts`

Fixture: `{ api }`

#### Scenario 8 (BK-550)
Test: `"BK-497: should allow a workspace-admin action when the PAT is correctly scoped and bound to the target workspace"`
Preconditions: `authenticateSuccessfully()`; discover `workspace_id`; `tokens.mintPatWithScopes({ scopes: ['workspace:admin'], workspace_id })`; set as ambient `workspace.authToken`.
ATCs called: `WorkspaceApi.allowWorkspaceAdminActionWithBoundPat({ workspaceId, body })`
Test-level assertions: none beyond the ATC's own fixed assertions (positive control).
Teardown: none — no-op-equivalent write (name set to its own value).

#### Scenario 9 (BK-551)
Test: `"BK-497: should reject a workspace-admin action when the PAT is bound to a different workspace"`
Preconditions: `authenticateSuccessfully()`; discover `workspace_a_id`; `tokens.mintPatWithScopes({ scopes: ['workspace:admin'], workspace_id: workspace_a_id })`; set as ambient `workspace.authToken`; `workspace_b_id = WORKSPACE_NOT_MEMBER_ID`.
ATCs called: `WorkspaceApi.rejectCrossWorkspaceAdminPat({ workspaceId: workspace_b_id, body })`
Test-level assertions: none beyond the ATC's own fixed assertions.
Teardown: none — 403 rejected before any mutation.

## 6. Implementation Order

- [ ] **Step 1**: Add `api/schemas/tokens.types.ts` (new facade)
- [ ] **Step 2**: Extend `api/schemas/workspace.types.ts` with the 4 new endpoint types
- [ ] **Step 3**: Promote `WORKSPACE_NOT_MEMBER_ID` to `tests/data/constants.ts`; add `INVALID_BEARER_TOKEN`; update `switchActiveWorkspace.test.ts`'s import
- [ ] **Step 4**: Create `tests/components/api/TokensApi.ts` — helpers (`issueToken`, `listTokens`, `revokeToken`, `mintPatWithScopes`) first, then ATCs BK-552, BK-553, BK-543, BK-546 (single-action ATCs)
- [ ] **Step 5**: Add BK-545 to `TokensApi.ts` (embedded 3-step ATC, reuses the Step 4 helpers)
- [ ] **Step 6**: Register `TokensApi` in `tests/components/ApiFixture.ts` (+ `setAuthToken`/`clearAuthToken` propagation override, mirroring the existing `workspace`/`bugs`/`notifications` pattern)
- [ ] **Step 7**: Add helpers (`getWorkspaceInvites`, `createWorkspaceInvite`) + ATCs BK-544, BK-548 to `WorkspaceApi.ts`
- [ ] **Step 8**: Add ATCs BK-550, BK-551 to `WorkspaceApi.ts`
- [ ] **Step 9**: Create `tests/integration/tokens/enforceTokenRouteCookieOnlyPosture.test.ts` (BK-552, BK-553, BK-543, BK-546)
- [ ] **Step 10**: Create `tests/integration/tokens/allowSessionTokenLifecycleUnaffectedByLift.test.ts` (BK-545)
- [ ] **Step 11**: Create `tests/integration/workspace/enforceInviteCapabilityScope.test.ts` (BK-544, BK-548)
- [ ] **Step 12**: Create `tests/integration/workspace/enforceWorkspaceAdminCapabilityScope.test.ts` (BK-550, BK-551)
- [ ] **Step 13**: Run + validate (`bun run test`, `types:check`, `lint:check`), regenerate `kata-manifest.json`

Each checked box maps to one commit (playbook rule of thumb — "new types" and "new ATC" never share a commit; Steps 4–5 and 7–8 may still need splitting further at Code-phase discretion if the diff grows).

## 7. Success Criteria

- [ ] All 9 TCs' fixed assertions automated — the floor, not the bar
- [ ] Risk-beyond-AC: identity-resolution-before-posture-check ordering (BK-546) is itself an
      Error-Guessing-derived TC, already included — no further BVA/state-transition technique
      applies (all inputs are scope/channel enums, not ranges; see each `atc/*.md` §6)
- [ ] KATA compliance: every ATC atomic, no ATC-calls-ATC (BK-545's 3 embedded calls are `@step`
      helpers, not other `@atc` methods), max 2 positional params (all use a single args object
      or zero/one param), inline locators n/a (API-only)
- [ ] Fixture correct: `{ api }`, no browser opened, confirmed no UI element in any of the 9 TCs
- [ ] No hardcoded workspace/token IDs except the 2 documented, precedented constants
- [ ] Aliases used (`@api/`, `@schemas/`, `@utils/`, `@TestFixture`, `@data/`)
- [ ] `bun run test`, `types:check`, `lint:check` all green
- [ ] `kata-manifest.json` regenerated and staged, `bun run kata:manifest:check` passes
