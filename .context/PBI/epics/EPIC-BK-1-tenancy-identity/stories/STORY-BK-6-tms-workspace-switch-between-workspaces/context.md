# BK-6 — Session Context

## Session Notes
- TMS Modality: jira-native
- Active env: staging (https://staging-upexbunkai.vercel.app)
- DB MCP: staging-dbhub
- Session Start: 2026-06-06

## Test Data

### Multi-Workspace User (Happy Path)
- **user_id**: `0cdfea29-cbf7-4762-b4aa-f6d152492f43`
- **Email**: `bunkai-staging-userlf@ambuusteln.resend.app` (STAGING_USER_EMAIL in .env)
- **Active workspace memberships**: 12 workspaces

Key workspaces for switching tests:
| workspace_id | name | slug | status |
|---|---|---|---|
| `9a2c3de7-18af-45e5-a36f-e0ef9377af69` | Extra Test | extra-test | active |
| `a808499e-f437-43b8-9fdb-8cee7dcceb3e` | Bünkāï QA | bunkai-qa | active |
| `7d14c652-1daa-4275-a4c7-f7af529e8a6a` | AB | ab-workspace | active |
| `c828d131-f1c7-413c-9ba4-723fa1c45c00` | BK5 Test Workspace | bk5-test-ws | active |
| `aed86386-2ed8-424e-934b-ca7a0ef6af37` | QA Test Workspace | qa-test-ws-20260605 | active |

### Negative Test Data — Suspended Membership
- **RISK**: No `suspended` workspace_members rows exist in staging as of 2026-06-06.
- To test AC3 (MEMBERSHIP_SUSPENDED), a suspended membership row must be created manually or via a setup script.
- Workaround for non-member test (AC2): use any workspace_id that the test user does NOT belong to (e.g. `bd947203-5318-4724-9608-7676c7af83c0` — owned by a different user).

### Cookie Info
- Cookie name: `bk_active_ws`
- httpOnly: true, sameSite: lax, maxAge: 90 days, path: /
- Set by POST /api/v1/me/active-workspace

## Open Questions (Resolved)
1. **Suspended membership test data**: RESOLVED — inserted suspended row via QA_INSPECTOR_RW_URL before TC3. Restored after TC3. ✓
2. **UI navigation after switch**: RESOLVED — PO accepted `/projects` as correct; spec is stale. DISC-002 ACCEPTED.
3. **Active workspace indicator**: RESOLVED — cookie-based persistence verified. URL workspace context deferred per Out-of-Scope.

## Bugs Filed
- **BK-83** (2026-06-06) — POST /api/v1/me/active-workspace response missing workspace fields (id, slug, name, role). Severity: Moderate. Linked to AC1 of BK-6. Bug back-referenced in BK-6 comments.

## Stage 2 Status
- Stage 2 Execution: COMPLETED (2026-06-06)
- TC1 FAILED (DEF-001 filed as BK-83)
- TC2, TC3, TC4: PASSED
- Overall result: FAILED (1/4 TCs failed due to DEF-001)
- Next: Stage 3 Reporting

## Final Status

**Result:** BLOCKED
**Workflow Complete:** 2026-06-06
**Next:** Wait for BK-83 fix, re-run TC1, re-evaluate for QA Approved

## Stage 4 — Test Documentation (2026-07-31)

- ATP/ATR backfilled into dedicated Jira fields `customfield_10067` / `customfield_10147` (previously only in comments — see BK-6 comment history).
- 4 TCs documented and created in Jira as `Test` issues, all verdict Candidate: BK-250 (TC1), BK-251 (TC2), BK-252 (TC3), BK-253 (TC4). Local cache under `test-cases/`.

### Pending — Improvement not yet filed
- **Gap**: `workspace_members.status` has a live DB CHECK constraint allowing a third value, `invited` (pending, unaccepted invite) — confirmed via direct query on staging. No AC and no TC (TC1–TC4) covers a workspace-switch attempt while `status = 'invited'`.
- **Action needed**: file a Jira Improvement asking PO/Dev to clarify expected behavior (should an invited-but-unaccepted user get 403 like a non-member, or something else?), then extend AC3 / add a TC once resolved. NOT filed yet — flagged here as pending.
