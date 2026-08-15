# DT-T14: Write a notifications row given a bug is assigned

| Field | Value |
|-------|-------|
| **Priority** | Medium |
| **Phase** | Standalone (regression-driven, single TC) |
| **Source** | Story: BK-264 / TC: BK-489 |

## Summary

Beyond-AC risk (integration contract) — a bug's first assignment fans out exactly 1 `notifications` row with `event_type: "bug.assigned"`. Documented dependency for BK-212 (Notifications).

## Read-surface note

Unlike BK-487 (TC13, blocked — no read surface for `activity_log`), this TC IS API-verifiable: `GET /api/v1/workspaces/{id}/notifications` returns the caller's own notification inbox. The trick is reading it AS THE RECIPIENT (the newly-assigned member), not the actor who performed the assignment — that's what makes it a genuine fan-out check rather than an echo of the assign response.

## Test Case

**Precondition**: open, unassigned bug.
**Action**: `POST /bugs/{id}/assign` with `{ assignee_user_id: <member user id> }` — first assignment.
**Expected**: 200 (fixed, inside ATC). Test-level: as the member, `GET /workspaces/{id}/notifications` contains a row with `entity_id` = bug id, `event_type: "bug.assigned"`, `entity_type: "bug"`, `payload.assignee_user_id` = member id, `payload.previous_assignee_user_id` = null.

## Implementation

`BugsApi.assignBugTriggersNotification(bugId, payload)` — `@atc('BK-489')`. New read-only helper `NotificationsApi.getNotifications(workspaceId)` (new component, `tests/components/api/NotificationsApi.ts`, `api/schemas/notifications.types.ts`). Test: `tests/integration/bugs/assignTriggersNotification.test.ts`.

## Acceptance Criteria

- [x] Automated as `@atc('BK-489')`
- [x] Passes on staging
