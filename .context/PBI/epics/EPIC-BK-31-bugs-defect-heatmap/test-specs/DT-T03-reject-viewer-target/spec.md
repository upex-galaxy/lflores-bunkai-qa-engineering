# DT-T03: Reject assignment given the target is a Viewer-role member

| Field | Value |
|-------|-------|
| **Priority** | High |
| **Phase** | Standalone (regression-driven, single TC) |
| **Source** | Story: BK-264 / TC: BK-481 |

## Summary

AC8 (API leg) — assigning a bug to an active Viewer-role member must be rejected (422, `assignee_view_only`), leaving the bug unchanged.

## Test Case

**Precondition**: bug exists (any status). Target is `STAGING_VIEWER_EMAIL`'s user id (active viewer-role member of the sandbox workspace, provisioned this session).
**Action**: `POST /bugs/{id}/assign` with `{ assignee_user_id: <viewer user id> }`.
**Expected**: 422, `code: "validation_failed"`, `details.reason: "assignee_view_only"`; `assignee_user_id` unchanged.

## Implementation

`BugsApi.rejectAssignToViewer(bugId, viewerUserId)` — `@atc('BK-481')`. Test: `tests/integration/bugs/assignmentRejections.test.ts`.

## Acceptance Criteria

- [x] Automated as `@atc('BK-481')`
- [x] Passes on staging
