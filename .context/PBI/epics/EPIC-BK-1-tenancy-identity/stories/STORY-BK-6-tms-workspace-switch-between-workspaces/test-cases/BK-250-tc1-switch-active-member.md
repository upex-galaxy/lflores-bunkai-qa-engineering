---
tc_id: BK-250
story: BK-6
priority: highest
roi: 25.0
outcome: Candidate
labels: [regression, automation-candidate, e2e, epic-BK-1]
---

# BK-250: TC1: should update active workspace context when switching to a workspace given the user is an active member

## Preconditions
- User is authenticated
- User has an active membership (status = "active") in both `{workspace_from_id}` and `{workspace_to_id}`

## Action
User POSTs `/api/v1/me/active-workspace` with `{ workspace_id: {workspace_to_id} }`

## Expected Results
- Response is 200 OK
- Response body contains `{ ok: true, active_workspace_id, id, slug, name, role }` matching `{workspace_to_id}`
- Session cookie `bk_active_ws` is rotated to `{workspace_to_id}`
- Subsequent GET `/api/v1/me` reflects `active_workspace_id = {workspace_to_id}`

## Gherkin
```gherkin
@critical @regression @automation-candidate @BK-6
Scenario: should update active workspace context when switching to a workspace given the user is an active member
  Given a user authenticated with an active membership in "{workspace_from_id}" and "{workspace_to_id}"
  When the user POSTs "/api/v1/me/active-workspace" with { workspace_id: "{workspace_to_id}" }
  Then the response is 200 OK
  And the response body contains { ok: true, active_workspace_id: "{workspace_to_id}", id: "{workspace_to_id}", slug, name, role }
  And a subsequent GET "/api/v1/me" reflects active_workspace_id "{workspace_to_id}"
```

## Variables
| Variable | How to obtain |
|----------|---------------|
| `{user_id}` | `SELECT id FROM auth.users WHERE email = '{STAGING_USER_EMAIL}'` |
| `{workspace_from_id}` | Workspace where `{user_id}` has an active membership (starting workspace) |
| `{workspace_to_id}` | Second workspace where `{user_id}` has an active membership (target workspace) |

## Refinement Notes
Original AC1 spec response schema `{id, slug, name, role}` did not match the implementation on first pass (BK-83) — implementation returned only `{ok, active_workspace_id}`. Fixed and verified 2026-06-12; response now matches spec.
