# DT-T06: Clear the assignee when unassigning

| Field | Value |
|-------|-------|
| **Priority** | High |
| **Phase** | Standalone (regression-driven, single TC) |
| **Source** | Story: BK-264 / TC: BK-485 |

## Summary

AC10 — unassigning an already-assigned bug (`assignee_user_id: null`) succeeds (200) and clears the assignee.

## Test Case

**Precondition**: bug already assigned to `STAGING_MEMBER_EMAIL`'s user id.
**Action**: `POST /bugs/{id}/assign` with `{ assignee_user_id: null }`.
**Expected**: 200, `assignee_user_id: null`; subsequent GET reflects unassigned.

## Implementation

`BugsApi.unassignBug(bugId)` — `@atc('BK-485')`. Test: `tests/integration/bugs/reassignAndUnassign.test.ts`.

## Acceptance Criteria

- [x] Automated as `@atc('BK-485')`
- [x] Passes on staging
