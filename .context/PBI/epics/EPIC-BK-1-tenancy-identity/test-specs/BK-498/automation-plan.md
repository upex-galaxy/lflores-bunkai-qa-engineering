# Test Automation Plan: BK-498

> Ticket: BK-498 — PAT | Enforce capability scopes on the authoring domain
> Type: integration (all 15 TCs — pure API, no UI)
> Sprint: n/a (post-Stage-4 automation pass)
> Created: 2026-08-21
> Batching: user requested groups of 5 for the Code phase — 3 sequential batches (TC1-5 / TC6-10 / TC11-15)

## 1. Ticket Summary

- What to test: `requireCapability` enforcement across 22 handlers in 6 authoring
  resource families (Modules, User Stories, Acceptance Criteria, Environments,
  Milestones, Imports) — right-scope success, wrong-scope 403, absent/revoked-token
  401 (distinct from capability 403), membership-403 (distinct from capability-403),
  browser-session non-narrowing, default-scope non-regression, and the Imports
  dual-scope split as ratified non-defect.
- Acceptance Criteria: AC-01 (write succeeds), AC-03 (read-only rejected on write, no
  side effect), AC-07 (unbound write token succeeds for real member), AC-08a
  (read-scoped succeeds on non-ATC read) — 4 formal ACs seed 15 outlines (1:N,
  11 of 15 are risk-beyond-AC per the ATP's Test-Design Checklist).
- Dependencies: BK-497 (merged) — reuses `TokensApi.mintPatWithScopes`,
  `AuthApi.authenticateSuccessfully`/`getCurrentUser` unchanged.

## 2. Architecture Decisions

### Component Strategy

| Decision | Value | Rationale |
|---|---|---|
| Component (new) | `ModulesApi.ts` | No existing component owns `/api/v1/projects/{id}/modules` or `/api/v1/modules/{id}/user-stories` — confirmed against `kata-manifest.json` (5 components: `AuthApi`, `BugsApi`, `NotificationsApi`, `TokensApi`, `WorkspaceApi`; none cover Modules). Owns the Decision-Table anchor family — TC1-10 (10 ATCs), all sharing one precondition shape (mint a scoped PAT, POST/GET against the same 2 endpoints). |
| Component (new) | `AuthoringSweepApi.ts` | TC11-15 are cross-family wiring checks, not Modules-specific — the ATP's own words: "same gate logic... only the wiring varies per family." A single component owns 5 endpoints across 5 *other* resource families (User Stories, Acceptance Criteria, Environments, Milestones, Imports) purely to confirm each is gated by the correct capability + the Imports positive control. Splitting into 5 one-ATC components (one per family) would fragment a single parametrized-sweep concept the ATP explicitly designed as 4 artifacts, not 20 TCs. |
| Fixture | `{ api }` | All 15 TCs are pure API, no UI element — confirmed by the ATP ("Backend-only — no UI surface in scope"). |
| Test files | 4 files across 2 module dirs — see §5 | verb+Feature naming (rule #15); grouped by component + flow family, mirroring BK-497's own file split. |
| Preconditions | Inline in test body, no Steps module | 15 ATCs across 2 new components + reused `TokensApi`/`AuthApi` — below the "3+ ATCs repeated across 3+ files" Steps threshold. `mintPatWithScopes` is already a `@step` on `TokensApi` (BK-497); called at the TEST level by both new components' test files, same pattern BK-497 established for `WorkspaceApi`. |

### [INTEGRATION] API Details

| Aspect | Value |
|---|---|
| Endpoints (`ModulesApi`) | `POST /api/v1/projects/{project_id}/modules`, `GET /api/v1/modules/{module_id}/user-stories` |
| Endpoints (`AuthoringSweepApi`) | `POST /modules/{id}/user-stories`, `POST /user-stories/{id}/acceptance-criteria`, `POST /projects/{id}/environments`, `POST /projects/{id}/milestones`, `POST /imports`, `GET /user-stories/{id}`, `GET /acceptance-criteria/{id}`, `GET /projects/{id}/environments`, `GET /projects/{id}/milestones`, `GET /imports/{id}` |
| OpenAPI Type(s) | New facades required — none of the 6 authoring families have a schema facade yet (`api/schemas/` currently only has `activity`, `auth`, `bugs`, `notifications`, `tokens`, `workspace`). Source paths already present and current in `api/openapi-types.ts` (no `bun run api:sync` needed): `modules` L1859/2501/2670, `milestones` L2260/2402, `environments` L1949, `user-stories` L2816/3028, `acceptance-criteria` L3165, `imports` L3372/3464. Code phase creates `api/schemas/modules.types.ts` (full facade — payload/response for Modules + nested UserStories-list) and `api/schemas/authoring-sweep.types.ts` (minimal per-family create-payload + response types, since `AuthoringSweepApi` only needs enough shape to build a valid write, not full CRUD). |
| Auth Required | Yes, on every route — auth SCOPE is the variable under test (not channel, which was BK-497's axis). |
| Return Pattern | Tuple `[APIResponse, TBody]` (GET) / `[APIResponse, TBody, TPayload]` (POST), per KATA convention. TC8 (`defaultScopeSucceedsOnWriteAndRead`) is a deliberate 2-action embedded-verification ATC (write then read, one PAT) — mirrors BK-497's `BK-545` pattern — returns `[APIResponse, APIResponse]`. |

## 3. ATC Registry

### Existing ATCs (Reuse)

| ATC ID | Component | Method | Description |
|---|---|---|---|
| BK-311 | `AuthApi` | `authenticateSuccessfully` | Establishes session (cookie + default PAT) — precondition for every TC that mints a scoped PAT or needs a cookie-only session (TC9) |
| — | `AuthApi` | `getCurrentUser` (`@step`) | Discovers caller identity — not needed here (project/workspace/module ids are fixed, staging-verified constants, per spec.md preconditions) |
| — | `TokensApi` | `mintPatWithScopes` (`@step`, BK-497) | THE shared precondition helper for every narrow/unbound/revoked/dual-scope PAT this plan needs |
| — | `TokensApi` | `revokeToken` (`@step`, BK-497) | Used by TC10's precondition (mint then immediately revoke) |

### New ATCs (Create) — `ModulesApi.ts`

| ATC ID | Method | Description |
|---|---|---|
| BK-556 (TC1) | `createModuleSuccessfully` | `atc:write` bound PAT → POST modules → 201, row exists |
| BK-560 (TC2) | `rejectModuleCreationReadOnlyPat` | `atc:read` PAT → POST modules → 403 "Missing required capability: atc:write", zero rows |
| BK-562 (TC3) | `createModuleWithUnboundPat` | `atc:write` unbound (`workspace_id: null`), real member → POST modules → 201 |
| BK-564 (TC4) | `listUserStoriesSuccessfully` | `atc:read` PAT → GET user-stories → 200 + list |
| BK-565 (TC5) | `rejectReadWithWriteOnlyPat` | `atc:write` PAT → GET user-stories → 403 "Missing required capability: atc:read" |
| BK-567 (TC6) | `rejectUnauthenticatedModuleCreation` | No Authorization header → POST modules → 401 "Authentication required." |
| BK-569 (TC7) | `rejectModuleCreationNonMember` | `atc:write` bound PAT, non-member user → POST modules → 403 reason `not_a_member`, zero rows |
| BK-570 (TC8) | `defaultScopeSucceedsOnWriteAndRead` | Default-scope PAT (`.auth/tokens.env`) → POST modules (201) then GET user-stories (200), embedded 2-action ATC |
| BK-557 (TC9) | `createModuleViaSessionRegardlessOfPatScope` | Cookie-only session, no PAT → POST modules → 201 |
| BK-558 (TC10) | `rejectRevokedTokenWithInvalidMessage` | Revoked `atc:write` PAT → POST modules → 401 "Invalid token." (distinct from TC2's valid-but-under-scoped 403) |

### New ATCs (Create) — `AuthoringSweepApi.ts`

| ATC ID | Method | Description |
|---|---|---|
| BK-559 (TC11) | `rejectWritesAcrossFamilies` | `atc:read` PAT → 5 parametrized write rows (UserStories/AC/Environments/Milestones/Imports) → 403 each, zero side effects. Imports-row 403 is the ratified non-defect. |
| BK-561 (TC12) | `acceptWritesAcrossFamilies` | `atc:write` PAT → same 5 write rows → 2xx each, row created each; **returns created-row ids/refs for TC13/TC14** |
| BK-563 (TC13) | `acceptReadsAcrossFamilies` | `atc:read` PAT + TC12's created rows → 5 parametrized read rows → 200 each |
| BK-566 (TC14) | `rejectReadsAcrossFamilies` | `atc:write` (write-only) PAT + TC12's created rows → 5 parametrized read rows → 403 each. Imports-row 403 is the ratified non-defect (positive control is TC15). |
| BK-568 (TC15) | `completeImportLifecycleDualScope` | Dual-scope (`atc:write`+`atc:read`) PAT → POST /imports (202, job id) → poll GET /imports/{id} until complete → 200. Positive control for TC11/TC14's Imports-family 403 rows. |

### New Helpers (No @atc)

| Component | Method | Returns | Description |
|---|---|---|---|
| `ModulesApi` | `createModule(projectId, payload)` (`@step`) | `[APIResponse, ModuleResponse, ModulePayload]` | Raw POST wrapper, reused by every write ATC in this component |
| `ModulesApi` | `getModuleUserStories(moduleId)` (`@step`) | `[APIResponse, UserStoriesListResponse]` | Raw GET wrapper, reused by TC4/TC5/TC8 |
| `AuthoringSweepApi` | one raw POST/GET wrapper per family (5+5) OR a single generic `attemptFamilyRequest(row)` (`@step`) that dispatches by `{ method, path, payload }` row shape | `[APIResponse, unknown]` | Decision deferred to Code phase — see Risks §6; either shape satisfies "no ATC-calls-ATC" since both are `@step` helpers, not `@atc` |

## 4. Test Data Strategy

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Fresh session (cookie + default PAT) | **Generate** | `api.auth.authenticateSuccessfully(credentials)` | `beforeEach`, every test | None (disposable staging env, same as BK-497) |
| Scoped/bound PAT (`atc:write` bound, `atc:read` bound, unbound `atc:write`, `workspace:admin` n/a here) | **Generate** | `api.tokens.mintPatWithScopes({ scopes, workspace_id? })` | `beforeEach`, per test | Recommended, not mandatory: `api.tokens.revokeToken(id)` in `afterEach` |
| Revoked `atc:write` PAT (TC10) | **Generate** | `mintPatWithScopes` then immediately `revokeToken` (session-authenticated) | Test body, before the ACTION | N/A — already revoked |
| Dual-scope PAT (TC15, and TC8's default-scope reuse) | **Generate / reuse** | `mintPatWithScopes({ scopes: ['atc:write','atc:read'] })`, or `.auth/tokens.env` `API_TOKEN_OWNER_STAGING` for TC8's literal default-scope-token requirement | Test body | Same as above |
| Non-member actor (TC7) | **Discover (design-time constant)** | Same pattern as BK-497/BK-551: this Story's non-member axis is the *acting user*, not the workspace — TC7 needs a PAT whose underlying user is NOT a member of `BK264 Defect Triage`'s workspace. Confirm at Code-phase whether `WORKSPACE_NOT_MEMBER_ID` (a workspace the STAGING_USER isn't in) is reusable here directly, i.e. mint the PAT bound to `WORKSPACE_NOT_MEMBER_ID` and target modules under the *original* project — needs a live-staging confirmation pass (flagged, not blocking) | Test body | None — read-only |
| Fixed project/workspace/module ids | **Static** | `2fee236f-1246-40c4-bfc4-d332287f9548` (project), `6646f244-a28c-441e-8486-9af33bdb5c11` (workspace), `175f8a08-20b9-4c96-a21a-e02dcae2837e` (module) — same fixtures Stage 2 execution used live (Engram `#216`) | `tests/data/constants.ts` (promote — now shared across ≥2 files: `ModulesApi` test files + `AuthoringSweepApi` test files) | None — read-only |
| Minimal valid payload per family (TC11/TC12 write rows) | **Generate** | `this.data.createTestId(...)`-backed titles/names per family — exact required fields resolved at Code phase from the OpenAPI paths cited in §2 | Inline per-row in `AuthoringSweepApi` | Rows created by TC12 intentionally persist through TC13/TC14 in the same test (see §5) |

### DataFactory / Constants additions

```typescript
// tests/data/constants.ts
export const BK264_DEFECT_TRIAGE_PROJECT_ID = '2fee236f-1246-40c4-bfc4-d332287f9548';
export const BK264_QA_SANDBOX_WORKSPACE_ID = '6646f244-a28c-441e-8486-9af33bdb5c11';
export const DEFECT_TRIAGE_MODULE_ID = '175f8a08-20b9-4c96-a21a-e02dcae2837e';
```

`WORKSPACE_NOT_MEMBER_ID` (BK-497) reused as-is for TC7 — confirm binding semantics at
Code phase (see Risks §6).

## 5. Test Scenarios

### File: `tests/integration/modules/enforceModuleCapabilityScope.test.ts`

Fixture: `{ api }`

#### Scenario 1 (BK-556 / TC1)
Test: `"BK-498: should create module successfully given a PAT scoped exactly atc:write"`
Preconditions: `authenticateSuccessfully()`; `tokens.mintPatWithScopes({ scopes: ['atc:write'], workspace_id })`; set as ambient `modules.authToken`.
ATCs called: `ModulesApi.createModuleSuccessfully(projectId, payload)`

#### Scenario 2 (BK-560 / TC2)
Test: `"BK-498: should reject module creation with 403 and no side effect given a PAT scoped exactly atc:read"`
Preconditions: same shape, `scopes: ['atc:read']`.
ATCs called: `ModulesApi.rejectModuleCreationReadOnlyPat(projectId, payload)`

#### Scenario 3 (BK-562 / TC3)
Test: `"BK-498: should create module successfully given an unbound atc:write PAT held by a real workspace member"`
Preconditions: `mintPatWithScopes({ scopes: ['atc:write'] })` — `workspace_id` omitted.
ATCs called: `ModulesApi.createModuleWithUnboundPat(projectId, payload)`

#### Scenario 4 (BK-564 / TC4)
Test: `"BK-498: should list user stories successfully given a PAT scoped atc:read"`
Preconditions: `mintPatWithScopes({ scopes: ['atc:read'], workspace_id })`.
ATCs called: `ModulesApi.listUserStoriesSuccessfully(moduleId)`

#### Scenario 5 (BK-565 / TC5)
Test: `"BK-498: should reject a read request with 403 given a PAT scoped only atc:write"`
Preconditions: `mintPatWithScopes({ scopes: ['atc:write'], workspace_id })`.
ATCs called: `ModulesApi.rejectReadWithWriteOnlyPat(moduleId)`

#### Scenario 6 (BK-567 / TC6)
Test: `"BK-498: should return 401 unauthenticated when no token is presented"`
Preconditions: none — `modules.clearAuthToken()`.
ATCs called: `ModulesApi.rejectUnauthenticatedModuleCreation(projectId, payload)`

#### Scenario 7 (BK-569 / TC7)
Test: `"BK-498: should reject module creation with a membership-403 given a correctly-scoped atc:write PAT whose user is not a workspace member"`
Preconditions: `mintPatWithScopes({ scopes: ['atc:write'], workspace_id: WORKSPACE_NOT_MEMBER_ID })` (see Risks §6 for the binding-semantics confirmation).
ATCs called: `ModulesApi.rejectModuleCreationNonMember(projectId, payload)`

#### Scenario 8 (BK-570 / TC8)
Test: `"BK-498: should continue succeeding on both read and write given a default-scoped PAT"`
Preconditions: use `.auth/tokens.env` `API_TOKEN_OWNER_STAGING` directly (no mint call needed — it's already the default-scope token).
ATCs called: `ModulesApi.defaultScopeSucceedsOnWriteAndRead(projectId, moduleId, payload)`

#### Scenario 9 (BK-557 / TC9)
Test: `"BK-498: should create module successfully via an authenticated browser session regardless of any PAT scope restriction"`
Preconditions: `authenticateSuccessfully()`; `modules.clearAuthToken()` (force cookie-only).
ATCs called: `ModulesApi.createModuleViaSessionRegardlessOfPatScope(projectId, payload)`

#### Scenario 10 (BK-558 / TC10)
Test: `"BK-498: should return 401 for a revoked atc:write token, distinct from the 403 an under-scoped-but-valid token receives"`
Preconditions: `mintPatWithScopes({ scopes: ['atc:write'], workspace_id })` → `tokens.revokeToken(id)` (session-authenticated) → set the now-revoked raw token string as ambient `modules.authToken`.
ATCs called: `ModulesApi.rejectRevokedTokenWithInvalidMessage(projectId, payload)`

### File: `tests/integration/authoring/rejectWritesAcrossAuthoringFamilies.test.ts`

Fixture: `{ api }`

#### Scenario 11 (BK-559 / TC11)
Test: `"BK-498: should reject writes across all authoring families given a PAT scoped exactly atc:read"`
Preconditions: `authenticateSuccessfully()`; `mintPatWithScopes({ scopes: ['atc:read'], workspace_id })`.
ATCs called: `AuthoringSweepApi.rejectWritesAcrossFamilies(moduleId, projectId)` — internally iterates the 5-row table, asserts 403 on every row (fixed assertion inside the ATC, per doctrine — a parametrized ATC's fixed assertions are the per-row checks, not a single external assert).

### File: `tests/integration/authoring/enforceAuthoringWriteReadSweep.test.ts`

Fixture: `{ api }`

#### Scenario 12-14 (BK-561 / BK-563 / BK-566 — TC12, TC13, TC14, chained in one test)
Test: `"BK-498: should accept writes and reads across all authoring families given correctly-scoped PATs, and reject reads for a write-only PAT"`
Preconditions: `authenticateSuccessfully()`; two PATs minted — `mintPatWithScopes({ scopes: ['atc:write'], workspace_id })` (write PAT) and `mintPatWithScopes({ scopes: ['atc:read'], workspace_id })` (read PAT).
ATCs called, in sequence within the same test:
1. `AuthoringSweepApi.acceptWritesAcrossFamilies(moduleId, projectId)` (write PAT ambient) → returns the 5 created-row refs
2. `AuthoringSweepApi.acceptReadsAcrossFamilies(createdRows)` (read PAT ambient) → 200 each
3. `AuthoringSweepApi.rejectReadsAcrossFamilies(createdRows)` (write PAT ambient again) → 403 each

**Chaining rationale**: TC12→TC13/TC14 is an ATP-documented data dependency ("These
created rows become TC13's read fixtures"), not accidental shared state. Each of the 3
Jira Test issues keeps its own `@atc('BK-56x')` method (individually callable, atomic —
each takes the row refs as a parameter, does not create them itself), satisfying
"ATC does not call ATC." The test file is what sequences them — same composition
pattern as any hybrid UI+API test, applied here to 3 API-only ATCs. Splitting into 3
independent tests would force either (a) 3x redundant row creation (defeats the
ATP's own "these rows become TC13's fixtures" design) or (b) fragile `beforeAll`
cross-test state, which is worse than one composed test.

### File: `tests/integration/authoring/completeImportLifecycleDualScope.test.ts`

Fixture: `{ api }`

#### Scenario 15 (BK-568 / TC15)
Test: `"BK-498: should complete a full import lifecycle successfully given a PAT scoped both atc:write and atc:read"`
Preconditions: `authenticateSuccessfully()`; `mintPatWithScopes({ scopes: ['atc:write', 'atc:read'], workspace_id })`.
ATCs called: `AuthoringSweepApi.completeImportLifecycleDualScope(projectId)` — embeds the create→poll loop as one ATC (mirrors BK-497's `BK-545` embedded-chain pattern); polling uses `waitForResponse`/condition-based retry, never a hardcoded `waitForTimeout` (rule #10).

## 6. Implementation Order — batched in groups of 5 (user request)

**Batch A (TC1-5, Modules anchor — positive/negative core)**
- [ ] Step A1: `api/schemas/modules.types.ts` (new facade: `ModulePayload`, `ModuleResponse`, `UserStoriesListResponse`)
- [ ] Step A2: Promote `BK264_DEFECT_TRIAGE_PROJECT_ID`/`BK264_QA_SANDBOX_WORKSPACE_ID`/`DEFECT_TRIAGE_MODULE_ID` to `tests/data/constants.ts`
- [ ] Step A3: Create `tests/components/api/ModulesApi.ts` — helpers (`createModule`, `getModuleUserStories`) + ATCs BK-556, BK-560, BK-562, BK-564, BK-565
- [ ] Step A4: Register `ModulesApi` in `tests/components/ApiFixture.ts`
- [ ] Step A5: Create `tests/integration/modules/enforceModuleCapabilityScope.test.ts` — Scenarios 1-5 only (TC6-10 appended in Batch B)
- [ ] Step A6: Run + validate (`bun run test <path>`, `types:check`, `lint:check`) before moving to Batch B

**Batch B (TC6-10, Modules edge cases — auth/membership/revocation)**
- [ ] Step B1: Add ATCs BK-567, BK-569, BK-570, BK-557, BK-558 to `ModulesApi.ts`
- [ ] Step B2: Extend `enforceModuleCapabilityScope.test.ts` with Scenarios 6-10
- [ ] Step B3: Confirm TC7's non-member PAT binding semantics live on staging (Risks §6) before finalizing Scenario 7
- [ ] Step B4: Run + validate

**Batch C (TC11-15, cross-family sweep + Imports positive control)**
- [ ] Step C1: `api/schemas/authoring-sweep.types.ts` (new facade — minimal create-payload + response shape per family, sourced from `api/openapi-types.ts` L2260-3464 range)
- [ ] Step C2: Create `tests/components/api/AuthoringSweepApi.ts` — helper (raw-dispatch or per-family, Code-phase decision) + ATCs BK-559, BK-561, BK-563, BK-566, BK-568
- [ ] Step C3: Register `AuthoringSweepApi` in `tests/components/ApiFixture.ts`
- [ ] Step C4: Create the 3 `tests/integration/authoring/*.test.ts` files (Scenarios 11, 12-14, 15)
- [ ] Step C5: Run + validate

**Final**: `bun run kata:manifest`, `git add kata-manifest.json`, `bun run kata:manifest:check`.

Each batch is its own Phase-2 Code subagent dispatch (sequential), with its own
progress-checkpoint append per `session-management.md` §7 — a resuming session can
tell exactly which batch completed.

## 7. Risks

| Risk | Mitigation |
|---|---|
| TC7's non-member-actor binding semantics unconfirmed for the Modules-family case (BK-497/BK-551 established the pattern for `workspace:admin` on the Workspace family; BK-498 needs the same shape confirmed for `atc:write`+Modules) | Batch B Step B3 — live staging confirmation before finalizing Scenario 7; if `mintPatWithScopes({ workspace_id: WORKSPACE_NOT_MEMBER_ID })` doesn't reproduce a `not_a_member` 403 against the *original* project's modules endpoint, the ATC signature may need an explicit second workspace/project pairing — Code-phase decision, not a plan blocker |
| `AuthoringSweepApi` helper shape (generic `attemptFamilyRequest(row)` vs 10 discrete per-family wrappers) undecided | Deferred to Code phase — either satisfies KATA (both `@step`, not `@atc`); Code subagent picks based on how much per-family payload validation the OpenAPI types actually require |
| Imports async job polling (TC15) needs a real completion condition, not a fixed wait | Use `expect.poll()` or a bounded retry loop checking `status !== 'pending'`, never `waitForTimeout` (rule #10) — Code-phase implementation detail |
| 3-ATC chain (TC12→13→14) in one test departs from "each test independent" default | Explicitly justified in §5 — ATP-documented data dependency, not accidental coupling; flagged here for Review-phase visibility |

## 8. Success Criteria

- [ ] All 15 TCs' fixed assertions automated — the floor, not the bar
- [ ] Risk-beyond-AC: 11 of 15 outlines (R5-R10, TC11/13/14 non-Modules rows, TC15) —
      no further BVA/state-transition applies (all inputs are scope/channel enums)
- [ ] KATA compliance: every ATC atomic, no ATC-calls-ATC (TC12/13/14 chained at the
      TEST level only), max 2 positional params, inline logic, `{ api }` fixture only
- [ ] No hardcoded project/workspace/module ids outside the 3 documented constants
- [ ] Aliases used (`@api/`, `@schemas/`, `@utils/`, `@TestFixture`, `@data/`)
- [ ] `bun run test`, `types:check`, `lint:check` all green per batch
- [ ] `kata-manifest.json` regenerated and staged, `bun run kata:manifest:check` passes
