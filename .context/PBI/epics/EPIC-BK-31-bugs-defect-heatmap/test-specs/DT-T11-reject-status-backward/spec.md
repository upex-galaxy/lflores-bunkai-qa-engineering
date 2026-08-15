# DT-T11: Reject a status change that moves backward or repeats the current status

| Field | Value |
|-------|-------|
| **Priority** | High |
| **Phase** | Standalone (regression-driven, single TC) |
| **Source** | Story: BK-264 / TC: BK-482 |

## Summary

AC6 — a status request that moves backward, or repeats the current status, is rejected (422, `status_transition_backward`), bug unchanged. The same-status row is deliberately folded into the backward bucket rather than exposed as a distinct reason (confirmed behavior, not a defect — message is imprecise for that row but functionally safe).

## Test Case (4 rows, EP — same outcome shape)

| current_status | target_status |
|---|---|
| resolved | open |
| in_progress | open |
| closed | in_progress |
| in_progress | in_progress (same-status) |

**Action**: `POST /bugs/{id}/status` with the backward/same target.
**Expected**: 422, `code: "validation_failed"`, `details.reason: "status_transition_backward"`; status unchanged.

## Implementation

`BugsApi.rejectStatusBackwardOrSame(bugId, payload)` — `@atc('BK-482')`. Test: `tests/integration/bugs/statusTransitions.test.ts`.

## Acceptance Criteria

- [x] Automated as `@atc('BK-482')`, all 4 rows
- [x] Passes on staging
