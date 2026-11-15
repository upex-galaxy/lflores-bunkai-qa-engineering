# BK-872: Workspace coverage discloses nothing to a non-member

| Field | Value |
|-------|-------|
| **Priority** | High (TC priority) |
| **Phase** | Standalone |
| **Items** | 1 TC |
| **Dependencies** | None |
| **Requires** | Cached `member` identity (`api-setup`), reserved fixture workspace `WORKSPACE_NOT_MEMBER_ID` (`bunkai1-qa`) |
| **Source** | Story: BK-259 (TMS-Home, Show workspace test coverage summary), TC9 |

## Summary

`GET /api/v1/workspaces/{id}/coverage` rolls up acceptance-criteria coverage for a workspace. The
contract promises non-disclosure: a foreign, nonexistent, deleted or lost-membership workspace id
returns the SAME zeroed `200` (null percentages) as a brand-new empty workspace, never a 403/404
that confirms the workspace exists and never real figures. The isolation lives in Postgres
(`bunkai_report_workspace_coverage` re-checks active membership against `auth.uid()`), so this TC
guards the one place a regression would leak cross-tenant data.

This is a regression guard for an already-signed manual result (ATR BK-878: TC9 PASSED).

## Preconditions

- `member` identity cached by `api-setup`; it is NOT a member of `WORKSPACE_NOT_MEMBER_ID`.
- `WORKSPACE_NOT_MEMBER_ID` has real content. Verified 2026-11-15 on staging (read-only DB count):
  2 projects, 2 live modules, 0 live acceptance criteria. Because it has 0 ACs, the `ac_*` fields
  alone cannot reveal a leak; `project_count` and `modules_total` are the discriminating fields.

## Test Cases

### BK-872: should disclose nothing given a forged workspace cookie pointing at a foreign workspace

**Preconditions**: A member of workspace A calls the coverage endpoint naming workspace B, where they have no membership.
**Action**: `GET /api/v1/workspaces/{foreignId}/coverage` as the member.
**Expected Output**:
- Status 200
- Body has the empty-workspace shape: `ac_total`, `ac_bound`, `ac_executed`, `ac_not_run`, `ac_uncovered`, `modules_total`, `modules_fully_covered`, `project_count` all 0; `ac_coverage_percent` and `executed_coverage_percent` null
- The same 200 and empty shape hold for a random UUID that does not exist, so a real foreign workspace and a nonexistent one are indistinguishable (no existence echo). The ATC asserts this for both ids; the test adds no separate comparison (it would be redundant: judgment-day round 1, 2026-11-15)

```gherkin
@regression @integration @BK-259
Scenario: BK-872 - should disclose nothing given a forged workspace cookie pointing at a foreign workspace
  Given a member of workspace A who has no membership in workspace B
  When the member requests the coverage summary of workspace B
  Then the response is 200 with the empty-workspace shape
  And the response is identical to the one for a workspace id that does not exist
```

## Known divergence between the TC text and the code

The TC says "forged cookie". The route does not read the active-workspace cookie: the workspace
comes from the path `{id}`. The manual run (ATR BK-878) also used a foreign id in the path. The
automation covers what the code does. The TC wording should be corrected in Jira (QA follow-up,
not done here).
