# DT-T12: Keep assignee and status changes independent of each other

| Field | Value |
|-------|-------|
| **Priority** | High |
| **Phase** | Standalone (regression-driven, single TC) |
| **Source** | Story: BK-264 / TC: BK-484 |

## Summary

Beyond-AC risk (data integrity / field cross-contamination) — reassigning a bug does not alter its `status`, and changing a bug's `status` does not alter its `assignee_user_id`.

## Test Case (2 rows, EP on "the write succeeds" shape; different untouched field per row — test-level)

| action | untouched field | precondition |
|---|---|---|
| reassign (`POST .../assign`) | `status` | bug advanced to `closed`, assigned |
| status change (`POST .../status`) | `assignee_user_id` | bug assigned, `open` |

**Fixed assertion** (inside ATC): the write itself succeeds (200).
**Test-level assertion**: a follow-up GET confirms the *other* field is unchanged — composes 2 endpoints, per KATA Rule 7.

## Implementation

`BugsApi.keepAssigneeAndStatusIndependent(bugId, action)` — `@atc('BK-484')`, reuses the `BugWriteAction` union from BK-486. Test: `tests/integration/bugs/fieldIndependence.test.ts` (2 separate `test()`s — preconditions differ too much for one parametrized loop).

## Acceptance Criteria

- [x] Automated as `@atc('BK-484')`, both directions
- [x] Passes on staging
