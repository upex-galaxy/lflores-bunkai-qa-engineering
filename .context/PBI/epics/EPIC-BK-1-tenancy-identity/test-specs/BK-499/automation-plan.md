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
| BK-679 | `WorkspaceApi` | `rejectBearerOnPostActiveWorkspaceMessage` | POST active-workspace, full-scope Bearer PAT → 403; **message assertion fails until BK-623 ships** |
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
| `ProjectsApi` | `createProject(args)` | `[APIResponse, ProjectResponse, body]` | Raw POST /workspaces/{id}/projects wrapper |

## 4. Test Data Strategy

| TC | Precondition | Pattern | Source | Feasibility |
|---|---|---|---|---|
| BK-671 | Any-scope PAT, no pre-existing workspace | Generate | `mintPatWithScopes()` then the ATC itself creates the workspace | Feasible |
| BK-672 | Cookie session only, no PAT | Generate | `authenticateSuccessfully()` leaves a cookie session; nothing else | Feasible |
| BK-673/674 | `project_id` / `test_id` / `workspace_id` for 2 of the 4 sampled routes | Discover, fallback Generate | `workspace_id` via `GET /me`'s `active_workspace_id`. `project_id`/`test_id` need a real project + test under that workspace | **Risky — resolve when coding BK-673**: confirm the QA-sandbox test user's default workspace already has a project/test, or generate one via `ProjectsApi.createProject` + existing `ModulesApi`/`AuthoringSweepApi` flows before this ATC runs |
| BK-675/676/681 | None beyond authenticated identity | Generate | `/activity` is workspace-scoped implicitly by session/PAT binding | Feasible |
| BK-677 | `workspace_id` for the notifications route | Discover | `GET /me`'s `active_workspace_id` | Feasible |
| BK-678/679 | `workspace_id` — irrelevant to the outcome (session-only guard fires before the handler body runs, so membership is never checked) | Discover | `GET /me`'s `active_workspace_id`, or any syntactically valid UUID | Feasible |
| BK-680 | `workspace_id` where DELETE membership will **actually execute** (cookie session passes the guard for real) | Generate — **disposable workspace** | Create a throwaway workspace via the BK-671 flow, then delete membership on THAT one — never the caller's main/home workspace | **Risky — resolve when coding BK-680**: confirm the API allows a sole owner to delete their own membership (may be blocked by a "workspace needs an owner" invariant); if blocked, this example may need a second invited member instead |
| BK-682 | Owner-role PAT on a workspace the caller owns | Generate | Reuse the BK-671 bootstrap flow — caller is owner of any workspace they create | Feasible |
| BK-683 | Viewer-role PAT on a workspace the caller is a viewer (not owner) of | Discover, fallback DB-Generate | **Risky — resolve when coding BK-683**: no self-service "become a viewer" API path is obvious yet; check whether an existing invite-accept flow or `dbhub` MCP seed is the intended route |
| BK-684 | `atc:write` PAT + member role (>= member) | Generate | Reuse the BK-671 bootstrap flow — owner counts as member | Feasible |
| BK-685 | PAT missing `atc:write` AND caller NOT a member of the target workspace | Discover | Same "real workspace, zero membership rows for caller" problem `WorkspaceApi.switchToNonMemberWorkspace` (BK-251) already solved — reuse whatever source that existing test uses (check `tests/integration/workspace/` when coding BK-685) |

**Never hardcoded**: the manual-QA session's sandbox IDs (`BK-264 QA Sandbox` workspace/project) are QA-tooling artifacts, not automation fixtures — no test in this plan references them directly. Every ID above is discovered or generated at runtime.

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
#### Scenarios 1–2 (BK-678, BK-679 — BK-679 tagged `@blocked:BK-623`)

### File: `tests/integration/workspace/allowCookieOnSessionOnlyRoutes.test.ts`
Fixture: `{ api }`
#### Scenario 1 (BK-680)

### File: `tests/integration/projects/createProject.test.ts`
Fixture: `{ api }`
#### Scenarios 1–2 (BK-684, BK-685)

## 6. Implementation Order

- [ ] TC1 (BK-671) — `WorkspaceApi` helpers + ATC, new test file (zero data dependency — first, to validate the whole pipeline end to end)
- [ ] TC2 (BK-672) — `TokensApi` ATC, new test file
- [ ] TC5, TC6, TC11 (BK-675/676/681) — `CapabilityGateApi` skeleton + the 3 zero-dependency ATCs
- [ ] TC12, TC13 (BK-682/683) — same component, resolve the viewer-role data question first
- [ ] TC3, TC4, TC7 (BK-673/674/677) — parametrized ATCs, resolve project/test discovery first
- [ ] TC8, TC9, TC10 (BK-678/679/680) — `WorkspaceApi` session-only extensions, resolve the disposable-workspace question for TC10 first
- [ ] TC14, TC15 (BK-684/685) — new `ProjectsApi`, resolve non-member-workspace discovery first
- [ ] `bun run kata:manifest` — regenerate registry after all components land
- [ ] TMS TC transitions to Pull Request when the PR opens

## 7. Success Criteria

- [ ] 15/15 TCs automated (14 green, BK-679 red-by-design and tagged `@blocked:BK-623`)
- [ ] KATA compliance (inline locators n/a — API-only; import aliases; max-2-positional-params; ATCs don't call ATCs)
- [ ] Fixture correct (`{ api }` throughout)
- [ ] No hardcoded waits, no hardcoded IDs
- [ ] Tests pass locally and on staging
- [ ] `kata-manifest.json` regenerated and clean
