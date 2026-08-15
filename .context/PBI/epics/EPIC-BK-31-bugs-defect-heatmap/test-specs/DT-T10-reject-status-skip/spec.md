# DT-T10: Reject a status change that skips a lifecycle stage

| Field | Value |
|-------|-------|
| **Priority** | High |
| **Phase** | Standalone (regression-driven, single TC) |
| **Source** | Story: BK-264 / TC: BK-478 |

## Summary

AC5 — a status request that skips one or more lifecycle stages ahead is rejected (422, `status_transition_skipped`), bug unchanged.

## Test Case (3 rows, EP — same outcome shape)

| current_status | target_status |
|---|---|
| open | resolved |
| open | closed |
| in_progress | closed |

**Action**: `POST /bugs/{id}/status` with the skip target.
**Expected**: 422, `code: "validation_failed"`, `details.reason: "status_transition_skipped"`; status unchanged.

## Implementation

`BugsApi.rejectStatusSkip(bugId, payload)` — `@atc('BK-478')`. Test: `tests/integration/bugs/statusTransitions.test.ts`.

## Acceptance Criteria

- [x] Automated as `@atc('BK-478')`, all 3 rows
- [x] Passes on staging
