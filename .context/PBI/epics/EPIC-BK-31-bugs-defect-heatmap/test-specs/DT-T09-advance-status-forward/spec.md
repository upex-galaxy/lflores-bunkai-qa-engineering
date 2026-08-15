# DT-T09: Advance status given a legal forward transition

| Field | Value |
|-------|-------|
| **Priority** | High |
| **Phase** | Standalone (regression-driven, single TC) |
| **Source** | Story: BK-264 / TC: BK-479 |

## Summary

AC2, AC3, AC4 — a bug advances one lifecycle stage at a time: open -> in_progress -> resolved -> closed. Rows 1-2 performed by the bug's assignee; row 3 (resolved -> closed) performed by a non-assignee Member+ actor (the owner), confirming status-transition access is workspace-wide, not assignee-restricted.

## Test Case

Single test, not parametrized — the 3 Examples rows are a sequential chain on one bug, not independent partitions.

1. File bug, assign to `STAGING_MEMBER_EMAIL`.
2. As the member: `POST /status {status: "in_progress"}`, then `{status: "resolved"}`.
3. As the owner (non-assignee): `POST /status {status: "closed"}`.

**Expected** per call: 200, `bug.status` matches target, persisted on GET.

## Implementation

`BugsApi.advanceStatusLegally(bugId, payload)` — `@atc('BK-479')`. Test: `tests/integration/bugs/statusTransitions.test.ts`.

## Acceptance Criteria

- [x] Automated as `@atc('BK-479')`, all 3 rows
- [x] Passes on staging
