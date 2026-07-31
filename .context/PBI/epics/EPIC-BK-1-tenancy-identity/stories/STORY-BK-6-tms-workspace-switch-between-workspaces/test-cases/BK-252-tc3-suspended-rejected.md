---
tc_id: BK-252
story: BK-6
priority: highest
roi: 20.0
outcome: Candidate
labels: [regression, automation-candidate, e2e, epic-BK-1]
---

# BK-252: TC3: should reject the switch with 403 given the user's membership in the target workspace is suspended

## Preconditions
- User is authenticated
- User has a `workspace_members` row for `{suspended_workspace_id}` with `status = "suspended"`

## Action
User POSTs `/api/v1/me/active-workspace` with `{ workspace_id: {suspended_workspace_id} }`

## Expected Results
- Response is 403 Forbidden
- Session's `active_workspace_id` is NOT changed
- DB: the membership row's `status` remains `"suspended"` after the attempt

## Gherkin
```gherkin
@critical @regression @automation-candidate @BK-6
Scenario: should reject the switch with 403 given the user's membership in the target workspace is suspended
  Given a user authenticated with a workspace_members row for "{suspended_workspace_id}" where status is "suspended"
  When the user POSTs "/api/v1/me/active-workspace" with { workspace_id: "{suspended_workspace_id}" }
  Then the response is 403 Forbidden
  And the session's active_workspace_id is not changed
  And the workspace_members row for "{suspended_workspace_id}" still has status "suspended"
```

## Variables
| Variable | How to obtain |
|----------|---------------|
| `{user_id}` | `SELECT id FROM auth.users WHERE email = '{STAGING_USER_EMAIL}'` |
| `{suspended_workspace_id}` | Workspace where `{user_id}`'s `workspace_members.status = 'suspended'` (seed via fixture, restore to `active` after run — mandatory cleanup) |

## Refinement Notes
Same gap as TC2 — generic `forbidden`, not `MEMBERSHIP_SUSPENDED`. Non-blocking per PO decision. DB check on `workspace_members.status` is mandatory (API+DB triforce), not just the HTTP code.

**Coverage gap (not a TC — see Improvement note):** `workspace_members.status` has a live DB CHECK constraint allowing a third value, `invited` (pending, unaccepted). Neither the AC nor any TC in this set covers switching while `status='invited'`. Not created as a TC — never validated, and the AC is silent on it. Recommend filing an Improvement to clarify expected behavior before adding a TC.
