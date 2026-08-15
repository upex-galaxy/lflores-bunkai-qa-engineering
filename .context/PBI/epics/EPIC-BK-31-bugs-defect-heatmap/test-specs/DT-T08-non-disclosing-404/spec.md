# DT-T08: Non-disclosing 404 for missing/foreign-workspace bugs

| Field | Value |
|-------|-------|
| **Priority** | High |
| **Phase** | Standalone (regression-driven, single TC) |
| **Source** | Story: BK-264 / TC: BK-488 |

## Summary

Beyond-AC risk (tenant isolation) — `POST /bugs/{id}/assign` returns the identical 404/not_found shape whether the bug id doesn't exist or belongs to a workspace the caller isn't a member of. Non-disclosing by design.

## Test Case

**Precondition** (2 rows, EP): (a) a random UUID with no matching `bugs` row; (b) a real `bugs` row confirmed via read-only DB query to belong to an unrelated workspace (`ba50b030-4380-4347-bead-0261c73dc5f1`) — the genuine foreign-workspace case, not a substitute, since this session has read-only DB access and no cross-tenant write is needed.
**Action**: `POST /bugs/{bug_id}/assign` with a valid body.
**Expected**: 404, `code: "not_found"`, identical shape for both rows.

## Implementation

`BugsApi.rejectNonDisclosingNotFound(bugId)` — `@atc('BK-488')`. Test: `tests/integration/bugs/notDisclosingNotFound.test.ts`.

## Acceptance Criteria

- [x] Automated as `@atc('BK-488')`, both rows including the real foreign-workspace case
- [x] Passes on staging
