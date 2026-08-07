# Test Automation Plan: BK-6

> Ticket: BK-6 — TMS-Workspace | Switch between workspaces
> Type: integration (BK-250/251/252) + e2e (BK-253)
> Sprint: n/a (backlog automation pass)
> Created: 2026-08-03

## 1. Ticket Summary

- What to test: the active-workspace switch endpoint (`POST /api/v1/me/active-workspace`) —
  success path, non-member rejection, suspended-member rejection, and the UI reflecting the
  switch after reload.
- Acceptance Criteria: see `story.md` Business Rules — active membership required, session
  scope rotates without invalidating the session, all subsequent responses scope to the new
  workspace.
- Dependencies: none. Prerequisite fix landed separately (`fix(auth): align bootstrap with
  real Supabase signin/me schema`, commit `03f181b`) — `AuthApi.authenticateSuccessfully()`
  now works against the real backend, which every ATC in this plan depends on as its login
  precondition.

## 2. Architecture Decisions

### Component Strategy

| Decision | Value | Rationale |
|---|---|---|
| Component | `WorkspaceApi.ts` (new) | No existing component owns `/me/active-workspace` — checked `kata-manifest.json`, only `AuthApi`/`ExampleApi` exist. |
| Fixture | `{ api }` | BK-250/251/252 are pure API — confirmed the session survives on the `bk_active_ws` cookie, which Playwright's `APIRequestContext` captures automatically from `Set-Cookie` on `/auth/signin` (verified live against staging, 2026-08-03). No browser needed. BK-253 will need `{ ui }` or `{ test }` — deferred. |
| Test file | `tests/integration/workspace/switchActiveWorkspace.test.ts` | verb+Feature naming (rule #15); one file for all 3 API TCs since they share the same component and flow family. |
| Preconditions | Inline in test body (Discover pattern) | No Steps module needed yet — only 3 ATCs, no repeated multi-ATC chain across 3+ files (rule for when Steps modules are warranted). |

### [INTEGRATION] API Details

| Aspect | Value |
|---|---|
| Endpoint | `POST /api/v1/me/active-workspace` |
| OpenAPI Type(s) | `ActiveWorkspaceBody`, `ActiveWorkspaceResponse`, `ActiveWorkspaceError` from `@schemas/workspace.types` (new facade, mirrors the `@openapi` migration pattern already used in `auth.types.ts`) |
| Auth Required | Yes — Bearer PAT (via `AuthApi.authenticateSuccessfully()`) AND the Supabase session cookie set by the same call. Playwright's request-context cookie jar makes both available without extra plumbing. |
| Return Pattern | Tuple: `[APIResponse, ActiveWorkspaceResponse, ActiveWorkspaceBody]` (POST convention) |

## 3. ATC Registry

### Existing ATCs (Reuse)

| ATC ID | Component | Method | Description |
|---|---|---|---|
| PROJ-101 | `AuthApi` | `authenticateSuccessfully` | Login precondition for every TC in this plan (fixed 2026-08-03, commit `03f181b`) |

### New ATCs (Create)

| ATC ID | Component | Method | Description | Status |
|---|---|---|---|---|
| BK-250 | `WorkspaceApi` | `switchToActiveWorkspace` | Switch to a workspace where the caller is an active member — expects 200 | **This session** |
| BK-251 | `WorkspaceApi` | `switchToNonMemberWorkspace` | Switch to a workspace with no membership row — expects 403 | Pending (next TC) |
| BK-252 | `WorkspaceApi` | `switchToSuspendedWorkspace` | Switch to a workspace where membership `status = 'suspended'` — expects 403 | Pending |

### New Helpers (No @atc)

None — `AuthApi.getCurrentUser()` already covers the `GET /api/v1/me` verification step every TC needs (workspace discovery + post-switch assertion).

## 4. Test Data Strategy

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| User with >= 2 active workspace memberships (BK-250) | **Discover** | `GET /api/v1/me` via `auth.getCurrentUser()` after login — real staging data (`Bünkāï QA`, `Extra Test`, `BK5 Test Workspace`, all `status='active'`) | Test body, before the action | None — read-only discovery, no mutation |
| Workspace with zero membership rows for the user (BK-251) | **Discover** (via DB `SELECT`, since no public endpoint lists foreign workspaces) | `staging-dbhub` query for a `workspaces.id` absent from the user's `workspace_members` | Test body / small `beforeAll` | None — read-only |
| Workspace with `status = 'suspended'` membership (BK-252) | **Modify** | DB `UPDATE workspace_members SET status='suspended' WHERE ...` on `BK5 Test Workspace` (kept isolated from BK-250's pool) | `beforeAll`, scoped to this test file | **Mandatory**: restore `status='active'` in `afterAll`, even on failure |

Nothing in this plan uses **Generate** — every precondition already exists or is a cheap Modify on isolated data. No `DataFactory` additions needed for BK-250.

### DataFactory / Constants additions

None for BK-250 (uses discovered live data, not faker-generated payloads).

## 5. Test Scenarios

### File: `tests/integration/workspace/switchActiveWorkspace.test.ts`

Fixture: `{ api }`

#### Scenario 1 (BK-250 — happy path, **this session**)

Test: `"BK-6: should update active workspace context when switching to a workspace given the user is an active member"`
Preconditions: login via `auth.authenticateSuccessfully()`; discover 2 active workspaces via `auth.getCurrentUser()`; `test.skip()` if fewer than 2 (Discover-pattern rule — never assert on precondition data).
ATCs called: `WorkspaceApi.switchToActiveWorkspace({ workspace_id: workspaceTo.id })`
Test-level assertions: `GET /me` (via `getCurrentUser()`) reflects `active_workspace_id === workspaceTo.id` — this is the cross-ATC flow assertion, not a fixed assertion inside the ATC (rule #7).
Teardown: none — switching back is not required (each test authenticates fresh; no shared mutable state across tests per KATA rule #13).

#### Scenario 2 (BK-251 — this session)

Test: `"BK-6: should reject workspace switch given the user has no active membership"`
Preconditions: login via `auth.authenticateSuccessfully()`; target workspace is a fixed
reference constant `WORKSPACE_NOT_MEMBER_ID` (`bunkai1-qa`) — see
`atc/BK-251-switch-non-member-workspace.md` §7 for why this deviates from the original
"DB SELECT Discover" strategy (no runtime DB client exists in this framework) and why
Generate (signup+email+confirm+create-workspace) was rejected as disproportionate.
ATCs called: `WorkspaceApi.switchToNonMemberWorkspace({ workspace_id: WORKSPACE_NOT_MEMBER_ID })`
Test-level assertions: `GET /me` `active_workspace_id` unchanged from before the attempt
(session did not partially rotate on a rejected request).
Teardown: none — no mutation occurred (403 rejected before any state change).

#### Scenario 3 (BK-252 — this session)

Test: `"BK-6: should reject workspace switch given the user has a suspended membership"`
Preconditions: login via `auth.authenticateSuccessfully()`; target workspace is a fixed
reference constant `WORKSPACE_SUSPENDED_ID` (`BK5 Test Workspace`) — see
`atc/BK-252-switch-suspended-workspace.md` §7 for why this deviates from the original
"DB Modify in beforeAll/afterAll" strategy (no runtime DB client exists in this framework)
and why the fixture is hand-mutated once (permanent) rather than mutate-and-restore per run.
ATCs called: `WorkspaceApi.switchToSuspendedWorkspace({ workspace_id: WORKSPACE_SUSPENDED_ID })`
Test-level assertions: `GET /me` `active_workspace_id` unchanged from before the attempt
(session did not partially rotate on a rejected request).
Teardown: none — no mutation occurred by the test itself (403 rejected before any state
change); the fixture's suspended status is permanent, not per-run.

## 6. Implementation Order

- [x] ~~Fix `AuthApi.ts` auth bootstrap~~ (done as prerequisite, commit `03f181b`)
- [x] **Step 1**: Add `api/schemas/workspace.types.ts` (type facade) — commit `deea5f4`
- [x] **Step 2**: Create `tests/components/api/WorkspaceApi.ts` with `switchToActiveWorkspace` ATC (`BK-250`) — commit `9be08a9`
- [x] **Step 3**: Register `WorkspaceApi` in `tests/components/ApiFixture.ts` — commit `9be08a9`
- [x] **Step 4**: Create `tests/integration/workspace/switchActiveWorkspace.test.ts` with the BK-250 scenario — commit `9be08a9`
- [x] **Step 5**: Run + validate (`bun run test`, `types:check`, `lint:check`), regenerate `kata-manifest.json` — done; run is RED on a real product defect (BK-316), not a code/test bug — see progress.md
- [ ] **Step 6 (this session)**: Add `switchToNonMemberWorkspace` (BK-251) — same file, same component
- [x] **Step 7**: Add `switchToSuspendedWorkspace` (BK-252) — same file, same component; fixture hand-mutated once via `QA_INSPECTOR_RW_URL` instead of a runtime `beforeAll`/`afterAll` DB Modify (no DB client wired into `tests/`)
- [ ] Step 8 (blocked): BK-253 — needs real `data-testid`s captured from the frontend source first

Each checked box maps to one commit (rule of thumb from the playbook — "new types" and "new ATC" never share a commit).

## 7. Success Criteria (BK-250 scope only — this session)

- [ ] AC covered: active member switch returns 200 with correct workspace context (the floor)
- [ ] Risk-beyond-AC: cross-ATC verification that `GET /me` actually reflects the new scope (not just that the switch endpoint itself returned 200 — a response can lie, the follow-up read can't)
- [ ] KATA compliance: ATC atomic, no ATC-calls-ATC, inline locators n/a (API test), max 2 positional params
- [ ] Fixture correct: `{ api }`, no browser opened
- [ ] No hardcoded waits, no hardcoded workspace IDs (Discover pattern only)
- [ ] Aliases used (`@api/`, `@schemas/`, `@utils/`, `@TestFixture`)
- [ ] `bun run test`, `types:check`, `lint:check` all green
- [ ] `kata-manifest.json` regenerated and staged
