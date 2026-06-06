# Test Session Memory — BK-6

## Ticket
- Key: BK-6
- Type: Story
- Title: TMS-Workspace | Switch between workspaces
- Epic: BK-1 (Tenancy & Identity)
- Status: Ready For QA
- Source spec: FR-004 — Workspace switch
- Labels: mvp, tenancy, wave-1

## TMS Modality
jira-native — ATP/ATR via Jira custom fields + comments (no Xray). XRAY credentials commented out in .env.

## Environment
- Active env: staging
- WEB_URL: https://staging-upexbunkai.vercel.app
- API_URL: https://staging-upexbunkai.vercel.app/api/v1
- DB_MCP: staging-dbhub
- WEB_URL_OVERRIDE: none
- API_URL_OVERRIDE: none

## PBI Folder
.context/PBI/epics/EPIC-BK-1-tenancy-identity/stories/STORY-BK-6-tms-workspace-switch-between-workspaces/

## Acceptance Criteria (4 scenarios)
1. **AC1 — Successful workspace switch** (Happy Path)
   - Auth user is active member of Workspace A AND Workspace B
   - POST /api/v1/me/active-workspace { workspace_id: "B" }
   - → 200, rotates active_workspace_id, new workspace { id, slug, name, role }
   - → all subsequent API calls scoped to Workspace B

2. **AC2 — Switch to non-member workspace rejected**
   - User NOT a member of Workspace C
   - POST /api/v1/me/active-workspace { workspace_id: "C" }
   - → 403 with code NOT_A_MEMBER
   - → session NOT changed

3. **AC3 — Switch to suspended-membership workspace rejected**
   - User has workspace_members row with status="suspended" for Workspace D
   - POST switch
   - → 403 with code MEMBERSHIP_SUSPENDED
   - → session NOT changed
   - **NOTE**: No suspended memberships exist in staging; this requires test data setup

4. **AC4 — UI switcher reflects current active workspace**
   - User switches to Workspace B via API
   - Reload app
   - → switcher in header shows "Workspace B" as active
   - → URL persists workspace context (architecture-dependent)

## Business Rules (4 rules)
- BR1: User MUST be active member (status="active"); suspended/removed → 403
- BR2: Session's active_workspace_id = single source of truth for tenancy scoping in middleware
- BR3: Switch does NOT invalidate the session (only scope changes, JWT untouched)
- BR4: All subsequent API responses MUST reflect data scoped to new active workspace

## Key Implementation Details (from code exploration)
- **API endpoint**: POST /api/v1/me/active-workspace
  - Validates membership via RLS-filtered `workspaces` select (if user not a member, RLS returns nothing → 403)
  - Does NOT check `workspace_members.status` explicitly — relies on RLS
  - Response: `{ ok: true, active_workspace_id: "<uuid>" }` (does NOT return workspace name/slug/role — gap vs AC1 spec)
  - Sets httpOnly cookie `bk_active_ws` (sameSite: lax, maxAge: 90 days)
- **GET /api/v1/me**: reads `bk_active_ws` cookie to determine active_workspace_id
- **WorkspaceSwitcher component**: loads workspace list via GET /api/v1/me on dropdown open (lazy), POSTs to /api/v1/me/active-workspace, then calls `router.replace('/projects')` (NOT `/home` as spec says)
- **middleware.ts**: validates session cookie via Supabase — does NOT read `bk_active_ws` directly
- **Cookie**: `bk_active_ws` — NOT httpOnly in dev (secure only in production)

## Implementation Discrepancies Found + PO Decisions (2026-06-06)
1. AC1 response schema `{ id, slug, name, role }` vs actual `{ ok: true, active_workspace_id }` → **REPORT AS DEFECT** — spec is correct, implementation is missing fields.
2. Navigation `/home` vs `/projects` → **SKIP / ACCEPTED** — no `/home` route exists; `/projects` is correct behavior; spec is stale.
3. AC3 suspended error code may be generic `forbidden` vs `MEMBERSHIP_SUSPENDED` → **TEST AND REPORT** if code doesn't match spec.

## Test Data Found
### Primary test user (STAGING_USER_EMAIL)
- user_id: `0cdfea29-cbf7-4762-b4aa-f6d152492f43`
- Active in 12 workspaces — ideal for happy-path switching tests
- Recommended switch pair:
  - From: `a808499e-f437-43b8-9fdb-8cee7dcceb3e` (Bünkāï QA)
  - To:   `9a2c3de7-18af-45e5-a36f-e0ef9377af69` (Extra Test)

### Non-member workspace (for AC2)
- Any workspace where test user has no membership row
- Example: `bd947203-5318-4724-9608-7676c7af83c0` (Bunkaiqa — belongs to different user)

### Suspended membership (for AC3)
- **STATUS: READY** — inserted 2026-06-06 via QA_INSPECTOR_RW_URL
- workspace: "BK5 Test Workspace" (`c828d131-f1c7-413c-9ba4-723fa1c45c00`, slug: `bk5-test-ws`)
- user_id: `0cdfea29-cbf7-4762-b4aa-f6d152492f43`, role: owner → status updated to `suspended`
- **Restore after AC3**: UPDATE workspace_members SET status = 'active' WHERE user_id = '0cdfea29-cbf7-4762-b4aa-f6d152492f43' AND workspace_id = 'c828d131-f1c7-413c-9ba4-723fa1c45c00'

## Stage State
- Session Start: COMPLETED (2026-06-06)
- Stage 1 Planning: COMPLETED (2026-06-06)
  - Risk score: 13/15 — HIGH (veto override: auth + data integrity)
  - TCs planned: 4 (TC1–TC4, one per AC)
  - ATP posted: customfield_10120 (🧪 Acceptance Test Plan ATP) via REST PUT → HTTP 204 ✓
  - ATP mirror comment: posted to BK-6 ✓
  - Ticket transitioned: Ready For QA → In Test ✓
  - Surface coverage: UI + API + DB (triforce)
  - Known defects to file in Stage 2: DEF-001 (response schema mismatch AC1)
  - Known discrepancies accepted: DISC-002 (/home→/projects navigation)
  - Known risks to test and report: DISC-003 (AC3 error code — MEMBERSHIP_SUSPENDED vs actual)
- Stage 2 Execution: COMPLETED (2026-06-06)
- Stage 3 Reporting: COMPLETED (2026-06-06)
  - ATR: customfield_10284 PUT returned HTTP 400 (field not on Edit screen) → fallback: ATR posted as comment on BK-6 ✓
  - QA comment (Template B — Story FAILED): posted to BK-6 ✓
  - Blocker linked: BK-83 "is blocked by" BK-6 (Blocks link type, inward direction) ✓
  - Transition: In Test → BLOCKED (defect_reported) ✓
  - Final status: BLOCKED

## Stage 2 — Execution

**Env:** Staging
**Started:** 2026-06-06T21:35Z
**Completed:** 2026-06-06T22:00Z

### Test User Note (Stage 2 Discovery)
- STAGING_USER_EMAIL (`bunkai-staging-userlf@ambuusteln.resend.app`) maps to user_id `2742da39-e0ff-4f0c-a0a1-88dae804e14f` — a DIFFERENT user from Stage 1 test user `0cdfea29`.
- Stage 2 test user had zero workspace memberships at execution start — memberships were added via QA_INSPECTOR_RW_URL before TC execution.
- Memberships added: Bünkāï QA (member/active), Extra Test (member/active), BK5 Test Workspace (owner/suspended).

### Smoke
- Step 1 GET /health: `{"ok":true,"service":"bunkai-tms","env":"staging"}` ✓
- Step 2 Auth: POST /api/v1/auth/signin → 200, cookie `sb-fmbpikzpkafptqximhxn-auth-token` set ✓
- Step 3 GET /api/v1/me: 200, workspaces list returned (after membership setup) ✓
- Result: **GO**

### API Exploration
| Endpoint | Scenario | Expected | Actual | Result |
|----------|----------|----------|--------|--------|
| POST /me/active-workspace | TC2: non-member (bd947203) | 403 NOT_A_MEMBER | 403 `forbidden` "You are not a member" | PASSED* |
| POST /me/active-workspace | TC3: suspended (c828d131) | 403 MEMBERSHIP_SUSPENDED | 403 `forbidden` "You are not a member" | PASSED* |
| POST /me/active-workspace | TC1: valid switch to Extra Test | 200 {id,slug,name,role} | 200 `{ok:true, active_workspace_id}` | FAILED (DEF-001) |
| GET /api/v1/me | TC1 follow-up: scope change | active_workspace_id=Extra Test | active_workspace_id=9a2c3de7 ✓ | PASSED |

*PASSED with observation: error code is `forbidden` not `NOT_A_MEMBER`/`MEMBERSHIP_SUSPENDED` as spec requires.

### DB Exploration
| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| TC2: no membership row for non-member workspace | 0 rows | 0 rows | PASSED |
| TC3: suspended row exists before test | status=suspended | suspended ✓ | PASSED |
| TC3: suspended row restored after test | status=active | active ✓ | PASSED |
| TC1: active workspace memberships intact | 3 rows | 3 rows ✓ | PASSED |

### UI Exploration
| AC | Scenario | Result | Evidence | Notes |
|----|----------|--------|----------|-------|
| AC4 | Switcher shows correct workspace before switch | PASSED | 01-switcher-before-switch.png | Shows "Bünkāï QA" |
| AC4 | Dropdown opens showing all workspaces | PASSED | 02-switcher-dropdown.png | Shows all 3 workspaces, active has checkmark |
| AC4 | Click Extra Test → workspace switches | PASSED | 03-after-switch.png | Navigated to /projects scoped to Extra Test |
| AC4 | Switcher persists after page reload | PASSED | 04-after-reload.png | Shows "Extra Test" after reload |

### TC Results Summary
| TC | AC | Scenario | Status | Defect | Notes |
|----|----|----------|--------|--------|-------|
| TC1 | AC1 | Happy path — switch to Extra Test | FAILED | BK-83 | 200 returned, workspace switched ✓; response schema missing {id,slug,name,role} |
| TC2 | AC2 | Non-member workspace rejected | PASSED | — | Error code is `forbidden` not `NOT_A_MEMBER` (observation, not blocking) |
| TC3 | AC3 | Suspended membership rejected | PASSED | — | Error code is `forbidden` not `MEMBERSHIP_SUSPENDED`; API uses RLS not status check |
| TC4 | AC4 | UI switcher reflects active workspace | PASSED | — | Switcher shows correct workspace before + after reload |

### Findings (carry to Stage 3)
- **BK-83** (DEF-001): POST /api/v1/me/active-workspace response missing {id, slug, name, role} — AC1 schema mismatch. Severity: Moderate. Filed 2026-06-06.
- **OBS-001**: Error codes for negative paths use generic `forbidden` instead of specific codes (`NOT_A_MEMBER`, `MEMBERSHIP_SUSPENDED`). The API uses RLS to filter — suspended memberships are treated identically to non-memberships at the RLS layer. Per PO decision: TEST AND REPORT (not a blocking defect).
- **OBS-002**: Workspace switcher requires at least one project to exist in the workspace to render the full app layout (sidebar+header). Empty workspaces show an onboarding modal without the switcher visible. Not a bug — expected UX flow.
- **DB-CLEANUP**: Suspended row for BK5 Test Workspace restored to `active` after TC3. ✓

## Story Explanation
Bunkai supports multi-tenancy — one user can belong to multiple workspaces (e.g. one per client team). The workspace switcher lets a user change which workspace is "active" without logging out or creating a new session. When a user clicks a different workspace in the header dropdown, the app fires a POST to the API, which validates membership and sets an httpOnly cookie (`bk_active_ws`) storing the selected workspace ID. From that moment on, every API call reads that cookie and scopes all data (projects, modules, ATCs) to the new workspace. The UI then redirects to the projects list of the newly active workspace. The JWT session itself is never touched — only the soft preference cookie changes.

What we are testing:
- That switching actually works for a valid multi-workspace user (happy path)
- That the API rejects attempts to switch to a workspace the user doesn't belong to
- That suspended memberships cannot switch in
- That the UI header correctly reflects the active workspace after switching and after page reload

Key risks:
- Response schema mismatch (AC1 expects name/slug/role; API returns only ok + workspace_id)
- Navigation discrepancy (/projects vs /home)
- Suspended-membership error code may not match spec (MEMBERSHIP_SUSPENDED vs generic forbidden)
- Missing test data for AC3 (no suspended rows in staging)
