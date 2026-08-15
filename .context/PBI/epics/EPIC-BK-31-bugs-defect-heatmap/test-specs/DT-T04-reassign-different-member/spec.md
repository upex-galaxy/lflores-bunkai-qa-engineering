# DT-T04: Update the assignee when reassigning to a different member

| Field | Value |
|-------|-------|
| **Priority** | High |
| **Phase** | Standalone (regression-driven, single TC) |
| **Source** | Story: BK-264 / TC: BK-483 |

## Summary

AC9 — reassigning an already-assigned bug to a different eligible member succeeds (200), replacing the previous assignee.

## Test Case

**Precondition**: bug already assigned to `STAGING_MEMBER_EMAIL`'s user id.
**Action**: `POST /bugs/{id}/assign` with `{ assignee_user_id: <owner user id> }`.
**Expected**: 200, `assignee_user_id` = new id; subsequent GET reflects the same; previous assignee no longer set.

## Implementation

`BugsApi.reassignBugToDifferentMember(bugId, payload)` — `@atc('BK-483')`. Test: `tests/integration/bugs/reassignAndUnassign.test.ts`.

## Acceptance Criteria

- [x] Automated as `@atc('BK-483')`
- [x] Passes on staging
