# DT-T02: Reject assignment given the target is not a workspace member

| Field | Value |
|-------|-------|
| **Priority** | High |
| **Phase** | Standalone (regression-driven, single TC) |
| **Source** | Story: BK-264 / TC: BK-480 |

## Summary

AC7 — assigning a bug to a user id with no `workspace_members` row must be rejected (422, `assignee_not_workspace_member`), leaving the bug unchanged.

## Test Case

**Precondition**: bug exists (any status). Target is a random UUID (no membership row needed — the endpoint checks membership, not user existence).
**Action**: `POST /bugs/{id}/assign` with `{ assignee_user_id: <random uuid> }`.
**Expected**: 422, `code: "validation_failed"`, `details.reason: "assignee_not_workspace_member"`; `assignee_user_id` unchanged.

## Implementation

`BugsApi.rejectAssignToNonMember(bugId, nonMemberUserId)` — `@atc('BK-480')`. Test: `tests/integration/bugs/assignmentRejections.test.ts`.

## Acceptance Criteria

- [x] Automated as `@atc('BK-480')`
- [x] Passes on staging
