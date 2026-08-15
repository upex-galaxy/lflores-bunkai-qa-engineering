# DT-T07: Reject a write action given the actor is a Viewer-role member

| Field | Value |
|-------|-------|
| **Priority** | High |
| **Phase** | Standalone (regression-driven, single TC) |
| **Items** | 1 TC |
| **Dependencies** | None |
| **Requires** | An active `viewer`-role identity that can log in (not just be referenced by id) |
| **Source** | Story: BK-264 / TC: BK-486 |

## Summary

Validates the authorization boundary beyond the AC floor: a workspace member with role `viewer` (active member, no write access) must be rejected with 403 on both write endpoints the defect-triage feature exposes — assign and status-change. This is a beyond-AC risk case (authorization boundary), not a literal AC verification.

## Preconditions

- A bug exists in the target workspace (any status/assignee).
- The actor is authenticated as an active `viewer`-role member of that workspace.

## Test Cases

### BK-486: should reject a write action given the actor is a Viewer-role member

**Preconditions**: Actor logged in as `STAGING_VIEWER_EMAIL` (role `viewer` in the `BK-264 QA Sandbox` workspace). Target bug exists.
**Action**: Actor POSTs `/api/v1/bugs/{bug_id}/assign` (action=assign) or `/api/v1/bugs/{bug_id}/status` (action=status-change) with a valid body for that action.
**Expected Output**:
- Response is 403 with `code: "forbidden"`, `details.reason: "not_a_member"` for both actions
- The bug is unchanged by the rejected request (verified via `GET /bugs/{id}`)

```gherkin
Scenario Outline: BK-486 - should reject a write action given the actor is a Viewer-role member
  Given a bug exists in workspace "{workspace_id}"
  And the actor is an active member of "{workspace_id}" with role "viewer"
  When the actor POSTs "<endpoint>" with a valid body for that action
  Then the response is 403 with reason "not_a_member"
  And the bug is unchanged by the rejected request

  Examples: Write actions blocked for Viewer role
    | action        | endpoint                      |
    | assign        | /api/v1/bugs/{bug_id}/assign  |
    | status-change | /api/v1/bugs/{bug_id}/status  |
```

---

## Acceptance Criteria

- [ ] 1 TC automated as a parameterized `@atc('BK-486')` (assign + status-change rows)
- [ ] Tests pass on staging (this ticket's active env)

## Refinement note carried from documentation

The `reason` slug `not_a_member` is imprecise for a Viewer (a Viewer IS an active member, just without write access). The 403 outcome is correct; only the message is imprecise. Non-blocking — asserted as-is (`not_a_member`), not treated as a defect.
