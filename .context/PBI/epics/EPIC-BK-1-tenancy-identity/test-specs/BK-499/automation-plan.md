# Test Automation Plan: BK-499

> Ticket: BK-499 — PAT | Enforce capability scopes on read, identity and notification routes
> Type: integration (API-only — no UI surface in this Story)
> Sprint: current
> Created: 2026-08-29

## 1. Ticket Summary

- What to test: the capability-scope gate (`withApiHandler` middleware, `requires: [...]`) applied uniformly across 24 handlers — correctly-scoped PATs pass, incorrectly-scoped PATs are rejected with the right message and status, workspace role never substitutes for a missing capability, session-only routes reject every Bearer PAT, identity/notification routes ignore scope entirely, and the gate runs before any downstream RLS/membership check.
- Acceptance Criteria: AC1 (bootstrap), AC2/AC3 (read-gated), AC4 (identity/notification no-capability), AC5 (session-only), AC6 (browser session never scope-restricted), AC7 (role never substitutes for capability), AC8 (write-gated, gate-before-membership).
- Dependencies: BK-497 (capability-posture machinery — merged, automated), BK-498 (authoring-domain routes — merged, automated). None outstanding.

## 2. Architecture Decisions

### Component Strategy

| Decision | Value | Rationale |
|---|---|---|
| `WorkspaceApi.ts` | **Extend** (existing) | Already owns `/workspaces`-family + `/me/active-workspace`; adding bootstrap/get/delete-membership methods keeps one resource, one file |
| `TokensApi.ts` | **Extend** (existing) | Already owns `/tokens`; the zero-scope-issuance ATC is a natural sibling of the existing token ATCs |
| `CapabilityGateApi.ts` | **New** | Cross-cutting proof of the gate itself, spanning 4+ unrelated domains (activity, traceability, test-runs, workspaces, identity, notifications). Mirrors the product code's own `lib/api/capability-enforcement.test.ts` separation — the feature under test is "the gate", not any one resource |
| `ProjectsApi.ts` | **New** | `POST /workspaces/{id}/projects` has no existing home; genuine business action (create project) with its own request/response shape |
| Fixture | `{ api }` | Every one of the 15 TCs is API-only; no browser interaction anywhere in this Story |
| Test files | `tests/integration/workspace/`, `tests/integration/tokens/`, `tests/integration/capability/` (new), `tests/integration/projects/` (new) | One file per feature per KATA naming convention |
| Preconditions | Inline per test (no Steps module) | No chain is reused 3+ times across 3+ files yet — below the Steps-module threshold |

### [INTEGRATION ONLY] API Details

| Aspect | Value |
|---|---|
| Endpoints | 24 handlers total; this Story samples across all 4 posture buckets (`atc:read` ×14, `atc:write` ×1, `cookie-only` ×2, `authenticated`-no-capability ×7) |
| OpenAPI Type(s) | `@schemas/workspace.types`, `@schemas/tokens.types` (existing); new `@schemas/projects.types` if not already generated — confirm via `bun run api:sync` before coding `ProjectsApi` |
| Auth Required | Yes, all 15 — every TC authenticates first via `AuthApi.authenticateSuccessfully()` |
| Return Pattern | Tuple `[APIResponse, TBody]` or `[APIResponse, TBody, TPayload]`, per existing component precedent |

## 3. ATC Registry

### Existing ATCs (Reuse — helpers only, no ATC reused directly since ATCs cannot call ATCs)

| Helper | Component | Used by |
|---|---|---|
| `mintPatWithScopes(overrides)` | `TokensApi` | Every TC that needs a scoped PAT (13 of 15) |
| `authenticateSuccessfully(credentials)` | `AuthApi` | Every TC (establishes cookie session + base identity) |
| `getCurrentUser()` | `AuthApi` | BK-677 (samples `GET /me`); also a Discover source for `active_workspace_id` |
| `getNotifications(workspaceId)` | `NotificationsApi` | BK-677 (samples `GET /workspaces/{id}/notifications`) |
| `postActiveWorkspace` pattern (private, suspend/restore Bearer) | `WorkspaceApi` | BK-679, BK-680 (reimplemented in-class, same pattern) |

### New ATCs (Create)

| ATC ID | Component | Method | Description |
|---|---|---|---|
| BK-671 | `WorkspaceApi` | `createWorkspaceWithAnyScope` | POST /workspaces, any-scope PAT → 201, caller becomes owner |
| BK-672 | `TokensApi` | `rejectZeroScopeTokenIssuance` | POST /tokens with `scopes: []`, cookie session → 422 |
| BK-673 | `CapabilityGateApi` | `allowReadScopedPatOnGatedRoute(route)` | Parametrized, 4 routes, `atc:read` PAT → 200 |
| BK-674 | `CapabilityGateApi` | `rejectPatMissingReadScopeOnGatedRoute(route)` | Parametrized, same 4 routes, `run:execute`-only PAT → 403 |
| BK-675 | `CapabilityGateApi` | `rejectWriteOnlyPatOnReadGatedRoute` | Fixed `/activity`, `atc:write`-only PAT → 403 |
| BK-676 | `CapabilityGateApi` | `allowReadPatWithExtraUnrelatedScope` | Fixed `/activity`, `atc:read`+`run:execute` PAT → 200 |
| BK-677 | `CapabilityGateApi` | `allowAnyAuthenticatedPatOnIdentityRoute(route)` | Parametrized, 2 routes, `run:execute`-only PAT → 200 |
| BK-678 | `WorkspaceApi` | `rejectBearerOnDeleteMembership` | DELETE membership, full-scope Bearer PAT → 403 "...Use a browser session." |
| BK-679 | `WorkspaceApi` | `rejectBearerOnPostActiveWorkspaceMessage` | POST active-workspace, full-scope Bearer PAT → 403; message assertion — **BK-623 confirmed fixed live on staging 2026-08-30, no longer red-by-design; Jira defect still shows Open, flagged for closure** |
| BK-680 | `WorkspaceApi` | `allowCookieSessionOnSessionOnlyRoutes` | Cookie session on both session-only routes → succeeds |
| BK-681 | `CapabilityGateApi` | `allowBrowserSessionOnGatedRouteNoScopeCheck` | Fixed `/activity`, cookie session (no PAT) → 200 |
| BK-682 | `CapabilityGateApi` | `rejectOwnerRoleMissingCapability(workspaceId)` | Owner-role PAT, `run:execute`-only → 403 |
| BK-683 | `CapabilityGateApi` | `allowViewerRoleWithCapability(workspaceId)` | Viewer-role PAT, `atc:read` → 200 |
| BK-684 | `ProjectsApi` | `createProjectSuccessfully` | POST project, `atc:write` PAT + member role → 201 |
| BK-685 | `ProjectsApi` | `rejectProjectCreationMissingCapability` | POST project, PAT missing `atc:write` + non-member → 403 naming the capability, not membership |

### New Helpers (No @atc)

| Component | Method | Returns | Description |
|---|---|---|---|
| `WorkspaceApi` | `createWorkspace(body)` | `[APIResponse, WorkspaceResponse, body]` | Raw POST /workspaces wrapper |
| `WorkspaceApi` | `getWorkspaceById(id)` | `[APIResponse, WorkspaceResponse]` | Raw GET /workspaces/{id} wrapper — also the vehicle for one of BK-673/674's 4 sampled routes |
| `WorkspaceApi` | `deleteMembership(workspaceId)` | `[APIResponse, void]` | Raw DELETE .../membership wrapper |
| `CapabilityGateApi` | none beyond the ATCs themselves | — | Every method is directly an ATC — there is no "read-only, no assertion" sub-step to extract, since each TC's entire identity IS the gate check |
| `ProjectsApi` | `createProject(args)` | `[APIResponse, ProjectResponse, body]` | Raw POST /workspaces/{id}/projects wrapper — built now (TC3/TC4 precondition chain), reused later by BK-684/685 |
| `AuthoringSweepApi` | `createAtc(args)` | `[APIResponse, AtcResponse, body]` | Raw POST /atcs wrapper — new, added 2026-08-30 for the TC3/TC4 precondition chain (product-domain ATC, distinct from KATA's `@atc`) |
| `AuthoringSweepApi` | `createTest(args)` | `[APIResponse, TestResponse, body]` | Raw POST /tests wrapper — new, added 2026-08-30 for the TC3/TC4 precondition chain (`GET /tests/{id}/runs` needs a real `test_id`) |

## 4. Test Data Strategy

| TC | Precondition | Pattern | Source | Feasibility |
|---|---|---|---|---|
| BK-671 | Any-scope PAT, no pre-existing workspace | Generate | `mintPatWithScopes()` then the ATC itself creates the workspace | Feasible |
| BK-672 | Cookie session only, no PAT | Generate | `authenticateSuccessfully()` leaves a cookie session; nothing else | Feasible |
| BK-673/674 | `project_id` / `test_id` / `workspace_id` for the 4 sampled routes | Hybrid: reuse committed fixtures + Generate | **Resolved 2026-08-30 (revised)**: discovered `tests/data/constants.ts` already establishes a committed-fixture precedent — `BK264_DEFECT_TRIAGE_PROJECT_ID`/`BK264_QA_SANDBOX_WORKSPACE_ID`/`DEFECT_TRIAGE_MODULE_ID`, shipped by BK-498's own sweep, with the exact justification this TC needs ("cannot be safely discovered... a fixed, documented reference is the only viable Discover-adjacent strategy"). Reused those 3 named constants for `/activity`, `/workspaces/{id}`, and the traceability route's `project_id` (story discovered via `getModuleUserStories`, same fallback-create pattern as `enforceAuthoringWriteReadSweep.test.ts`). For `/tests/{id}/runs`: rather than leaning on the single hand-seeded row (`"BK499 seed Test for tests-runs validation"`, staging `tests` row `04054ddc…`, created 2026-08-27 — fragile, breaks silently if ever deleted, and not a committed constant), a fresh product-domain ATC + Test is GENERATED every run (`createAcceptanceCriterion` → `createAtc` → `createTest`, all under the same committed module/story). `ProjectsApi.createProject` (built for this) ended up used only by BK-684/685, not this chain — kept, not dead code. |
| BK-675/676/681 | None beyond authenticated identity | Generate | `/activity` is workspace-scoped implicitly by session/PAT binding | Feasible |
| BK-677 | `workspace_id` for the notifications route | Discover | `GET /me`'s `active_workspace_id` | Feasible |
| BK-678/679 | `workspace_id` — irrelevant to the outcome (session-only guard fires before the handler body runs, so membership is never checked) | Discover | `GET /me`'s `active_workspace_id`, or any syntactically valid UUID | Feasible |
| BK-680 | `workspace_id` where DELETE membership will **actually execute** (cookie session passes the guard for real) | Generate — invite+accept a non-owner member | **Resolved 2026-08-30**: confirmed live on staging that a freshly bootstrapped workspace's SOLE OWNER is blocked from leaving it (409 `sole_owner`) — the originally-planned disposable-workspace-as-owner approach does not work. Fixed via the invite+accept flow instead: OWNER (`config.testUser`) creates a disposable workspace, invites `config.testViewer` as `member`, `config.testViewer` accepts (`POST /invites/accept`) and IS the caller for both session-only actions — a non-owner member with other active memberships elsewhere passes both leave-blockers. |
| BK-682 | Owner-role PAT on a workspace the caller owns | Generate | Reuse the BK-671 bootstrap flow — caller is owner of any workspace they create | Feasible |
| BK-683 | Viewer-role PAT on a workspace the caller is a viewer (not owner) of | Discover | **Resolved**: `config.testViewer` (BK-264 QA Sandbox, already provisioned) is a real Viewer-role member of a real workspace — no invite/DB-seed needed, `authenticateAs` + `GET /me` discovers it directly |
| BK-684 | `atc:write` PAT + member role (>= member) | Generate | Reuse the BK-671 bootstrap flow — owner counts as member | Feasible |
| BK-685 | PAT missing `atc:write` AND caller NOT a member of the target workspace | Discover + Generate (unbound PAT) | **Resolved 2026-08-30**: binding a PAT to `WORKSPACE_NOT_MEMBER_ID` at MINT time is itself rejected (403 — issuance requires the caller already be a member of the workspace being bound), so `rejectProjectCreationMissingCapability` uses an UNBOUND `atc:read`-scoped PAT (no `workspace_id` on mint) against the shared `WORKSPACE_NOT_MEMBER_ID` fixture instead — same "real workspace, zero membership rows for caller" fixture `WorkspaceApi.switchToNonMemberWorkspace` (BK-251) already established |

**Committed-fixture precedent**: `tests/data/constants.ts` already establishes named, documented UUID constants for durable fixtures that "cannot be safely discovered or generated at runtime" (`WORKSPACE_NOT_MEMBER_ID`, `BK264_DEFECT_TRIAGE_PROJECT_ID`, `BK264_QA_SANDBOX_WORKSPACE_ID`, `DEFECT_TRIAGE_MODULE_ID` — the last 3 shipped by BK-498). This plan's earlier "never hardcoded, manual-sandbox IDs are QA-tooling artifacts" line (written before that file was re-examined) meant "never a bare inline UUID" — it does NOT forbid the established named-constant pattern, which BK-673/674 now also uses. Genuinely one-off/disposable ids (workspaces, projects, tests, ATCs minted per-run) are still always discovered or generated at runtime, never hardcoded.

## 5. Test Scenarios

### File: `tests/integration/workspace/createWorkspace.test.ts`
Fixture: `{ api }`
#### Scenario 1 (BK-671): happy path — any-scope PAT bootstraps a workspace

### File: `tests/integration/tokens/rejectZeroScopeTokenIssuance.test.ts`
Fixture: `{ api }`
#### Scenario 1 (BK-672): zero-scope array rejected with 422 at issuance

### File: `tests/integration/capability/enforceCapabilityGate.test.ts`
Fixture: `{ api }`
#### Scenarios 1–8 (BK-673, BK-674, BK-675, BK-676, BK-677, BK-681, BK-682, BK-683)

### File: `tests/integration/workspace/rejectBearerOnSessionOnlyRoutes.test.ts`
Fixture: `{ api }`
#### Scenarios 1–2 (BK-678, BK-679)

### File: `tests/integration/workspace/allowCookieOnSessionOnlyRoutes.test.ts`
Fixture: `{ api }`
#### Scenario 1 (BK-680)

### File: `tests/integration/projects/createProject.test.ts`
Fixture: `{ api }`
#### Scenarios 1–2 (BK-684, BK-685)

## 6. Implementation Order

- [x] TC1 (BK-671) — `WorkspaceApi` helpers + ATC, new test file (zero data dependency — first, to validate the whole pipeline end to end)
- [x] TC2 (BK-672) — `TokensApi` ATC, new test file
- [x] TC5, TC6, TC11 (BK-675/676/681) — `CapabilityGateApi` skeleton + the 3 zero-dependency ATCs
- [x] TC12, TC13 (BK-682/683) — same component, viewer-role data resolved (`config.testViewer`, already provisioned)
- [x] TC3, TC4, TC7 (BK-673/674/677) — parametrized ATCs; project/test discovery resolved via committed fixtures + fresh-generated ATC/Test
- [x] TC8, TC9, TC10 (BK-678/679/680) — `WorkspaceApi` session-only extensions; TC10 resolved via invite+accept (sole-owner leave is blocked, confirmed live)
- [x] TC14, TC15 (BK-684/685) — new `ProjectsApi`; non-member-workspace resolved via an unbound PAT (binding to a non-member workspace is itself rejected at mint)
- [x] `bun run kata:manifest` — regenerated after all components landed (51→59 ATCs, 9→10 API components)
- [ ] TMS TC transitions to Pull Request when the PR opens

## 7. Success Criteria

- [x] 15/15 TCs automated, all green (BK-679/BK-623 confirmed fixed live on staging 2026-08-30 — no red-by-design test remains; Jira defect still shows Open, flagged for closure)
- [x] KATA compliance (inline locators n/a — API-only; import aliases; max-2-positional-params; ATCs don't call ATCs)
- [x] Fixture correct (`{ api }` throughout)
- [x] No hardcoded waits; disposable ids discovered/generated at runtime, durable fixtures via the committed `tests/data/constants.ts` pattern
- [x] Tests pass locally and on staging (full `--project=integration` run, 69/69 green, no regressions)
- [x] `kata-manifest.json` regenerated and clean
