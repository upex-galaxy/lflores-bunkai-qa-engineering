---
tc_id: BK-251
story: BK-6
priority: highest
roi: 80.0
outcome: Candidate
labels: [regression, automation-candidate, e2e, epic-BK-1]
---

# BK-251: TC2: should reject the switch with 403 given the user has no membership in the target workspace

## Preconditions
- User is authenticated
- User has NO membership row in `{non_member_workspace_id}` (workspace belongs to a different tenant)

## Action
User POSTs `/api/v1/me/active-workspace` with `{ workspace_id: {non_member_workspace_id} }`

## Expected Results
- Response is 403 Forbidden
- Session's `active_workspace_id` is NOT changed

## Gherkin
```gherkin
@critical @regression @automation-candidate @BK-6
Scenario: should reject the switch with 403 given the user has no membership in the target workspace
  Given a user authenticated with no membership row in "{non_member_workspace_id}"
  When the user POSTs "/api/v1/me/active-workspace" with { workspace_id: "{non_member_workspace_id}" }
  Then the response is 403 Forbidden
  And the session's active_workspace_id is not changed
```

## Variables
| Variable | How to obtain |
|----------|---------------|
| `{user_id}` | `SELECT id FROM auth.users WHERE email = '{STAGING_USER_EMAIL}'` |
| `{non_member_workspace_id}` | Any workspace with zero rows in `workspace_members` for `{user_id}` |

## Refinement Notes
Spec (AC2) expects error code `NOT_A_MEMBER`; implementation returns generic `forbidden` (RLS-based, no explicit status check). Accepted, non-blocking (PO decision 2026-06-06). Assert on HTTP 403 only.
