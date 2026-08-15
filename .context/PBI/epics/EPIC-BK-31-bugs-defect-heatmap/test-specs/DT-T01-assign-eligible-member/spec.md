# DT-T01: Assign an open defect to an eligible workspace member

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Phase** | Standalone (regression-driven, single TC) |
| **Items** | 1 TC |
| **Dependencies** | None |
| **Requires** | A workspace with an active `owner` + an active `member` (non-viewer); a `project` + `module` inside it |
| **Source** | Story: BK-264 / TC: BK-477 |

## Summary

Validates the core happy path of BK-264's defect-assignment feature: a workspace member with write access can assign an open, unassigned bug to any eligible workspace member (role `member` or `owner`, active status). This is the critical path everything else in the feature (reassign, unassign, status lifecycle) builds on.

## Preconditions

- A workspace exists with at least one active `owner` and one active `member` (non-viewer).
- A project + module exist inside that workspace.
- A bug exists in that module with status `open` and `assignee_user_id = null`.

## Test Cases

### BK-477: should set assignee when assigning an open bug to an eligible member

**Preconditions**: Bug exists with status `open`, `assignee_user_id = null`, in a workspace where the target is an active `member` or `owner`.
**Action**: Actor POSTs `/api/v1/bugs/{bug_id}/assign` with `{ assignee_user_id: <eligible_user_id> }`.
**Expected Output**:
- Response is 200 OK
- Response body's `bug.assignee_user_id` matches the requested id
- A subsequent `GET` (via list or single-bug read) reflects the same assignee
- Not visible: no change to `bug.status` (assign and status are independent — covered separately by TC12/BK-484)

```gherkin
Scenario Outline: BK-477 - should set assignee when assigning an open bug to an eligible member
  Given a bug exists with status "open" and no assignee in workspace "{workspace_id}"
  When the actor POSTs "/api/v1/bugs/{bug_id}/assign" with { assignee_user_id: "{assignee_user_id}" }
  Then the response is 200 OK
  And the response body's bug.assignee_user_id equals "{assignee_user_id}"

  Examples: Eligible roles
    | role   |
    | member |
    | owner  |
```

---

## Acceptance Criteria

- [ ] 1 TC automated as a parameterized `@atc('BK-477')` (member + owner rows)
- [ ] Tests pass on staging (this ticket's active env)
