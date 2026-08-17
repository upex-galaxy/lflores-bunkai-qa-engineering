# WS-T01: Switch between workspaces

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Phase** | Standalone |
| **Items** | 4 TCs |
| **Dependencies** | None |
| **Requires** | Test user with >= 2 active workspace memberships (already true in staging — see §Data Strategy in automation-plan.md) |
| **Source** | Story: BK-6 |

## Summary

Validates the active-workspace switch flow: an authenticated user can move their session's
tenancy scope between Workspaces they belong to, is rejected when the target workspace
is not an active membership, and the header UI reflects the switch after reload. This is
the core tenancy-scoping mechanism (FR-004) — every subsequent API response is scoped by
the session's `active_workspace_id`, so a broken switch silently leaks or blocks cross-tenant
data.

## Preconditions

- A test user account exists in `staging` with credentials in `.env` (`STAGING_USER_EMAIL` / `STAGING_USER_PASSWORD`).
- That user has active memberships (`workspace_members.status = 'active'`) in at least 2 workspaces (confirmed via DB: `Bünkāï QA`, `Extra Test`, `BK5 Test Workspace` — all active).

## Test Cases

### BK-250: should update active workspace context when switching to a workspace given the user is an active member

**Preconditions**: User is authenticated; user has an active membership in both `{workspace_from_id}` and `{workspace_to_id}`.
**Action**: User POSTs `/api/v1/me/active-workspace` with `{ workspace_id: {workspace_to_id} }`.
**Expected Output**:
- Response is 200 OK, body is `{ id, slug, name, role }` matching `{workspace_to_id}` (real OpenAPI schema — supersedes the stale `{ok, active_workspace_id}` shape in the original Jira TC text, see Refinement Note below)
- Session cookie `bk_active_ws` is rotated (implicit — verified indirectly via the next assertion)
- A subsequent `GET /api/v1/me` reflects `active_workspace_id = {workspace_to_id}`

```gherkin
@critical @regression @automation-candidate @BK-6
Scenario: BK-250 - should update active workspace context when switching to a workspace given the user is an active member
  Given a user authenticated with an active membership in "{workspace_from_id}" and "{workspace_to_id}"
  When the user POSTs "/api/v1/me/active-workspace" with { workspace_id: "{workspace_to_id}" }
  Then the response is 200 OK with body { id, slug, name, role } matching "{workspace_to_id}"
  And a subsequent GET "/api/v1/me" reflects active_workspace_id "{workspace_to_id}"
```

**Refinement Note (found during this Plan phase, 2026-08-03)**: `BK-250`'s Jira "Expected Results" field
still lists the pre-fix response shape `{ ok: true, active_workspace_id, id, slug, name, role }`. The
live `openapi.json` schema (`ActiveWorkspaceResponse`) is `{ id, slug, name, role }` only — doc drift,
not a product bug (the TC's own Refinement Note already says the implementation was fixed to match
spec on 2026-06-12, but the Expected Results text was never updated). Automating against the real
schema; flagging for a follow-up Jira edit on BK-250.

---

### BK-251: should reject the switch with 403 given the user has no membership in the target workspace

**Preconditions**: User is authenticated; user has no membership row in `{non_member_workspace_id}`.
**Action**: User POSTs `/api/v1/me/active-workspace` with `{ workspace_id: {non_member_workspace_id} }`.
**Expected Output**:
- Response is 403 Forbidden
- Session's `active_workspace_id` is not changed

```gherkin
@critical @regression @automation-candidate @BK-6
Scenario: BK-251 - should reject the switch with 403 given the user has no membership in the target workspace
  Given a user authenticated with no membership row in "{non_member_workspace_id}"
  When the user POSTs "/api/v1/me/active-workspace" with { workspace_id: "{non_member_workspace_id}" }
  Then the response is 403 Forbidden
  And the session's active_workspace_id is not changed
```

**Status**: Planned, not yet implemented (see automation-plan.md §6 Implementation Order).

---

### BK-252: should reject the switch with 403 given the user's membership in the target workspace is suspended

**Preconditions**: User is authenticated; user has a `workspace_members` row for `{suspended_workspace_id}` with `status = "suspended"`.
**Action**: User POSTs `/api/v1/me/active-workspace` with `{ workspace_id: {suspended_workspace_id} }`.
**Expected Output**:
- Response is 403 Forbidden
- Session's `active_workspace_id` is not changed
- DB: the membership row's `status` remains `"suspended"` after the attempt (API+DB triforce)

```gherkin
@critical @regression @automation-candidate @BK-6
Scenario: BK-252 - should reject the switch with 403 given the user's membership in the target workspace is suspended
  Given a user authenticated with a workspace_members row for "{suspended_workspace_id}" where status is "suspended"
  When the user POSTs "/api/v1/me/active-workspace" with { workspace_id: "{suspended_workspace_id}" }
  Then the response is 403 Forbidden
  And the session's active_workspace_id is not changed
  And the workspace_members row for "{suspended_workspace_id}" still has status "suspended"
```

**Status**: Planned, not yet implemented. Needs a dedicated workspace (isolated from BK-250's data pool — do not reuse `Bünkāï QA` / `Extra Test`) so the DB Modify (suspend → restore) cannot race BK-250's assumption that the user's memberships stay active. Candidate: `BK5 Test Workspace` (owner role, not consumed by BK-250).

---

### BK-253: should display the newly active workspace in the header switcher after switch and page reload

**Preconditions**: User has already switched the active workspace to `{workspace_to_id}` via the API.
**Action**: User reloads the page (full page reload).
**Expected Output**:
- Header workspace switcher displays `{workspace_to_name}` as the active workspace, before and after reload
- Dropdown lists all workspaces the user belongs to, with the active one visually marked

```gherkin
@high @regression @automation-candidate @BK-6
Scenario: BK-253 - should display the newly active workspace in the header switcher after switch and page reload
  Given a user has switched the active workspace to "{workspace_to_id}" via the API
  When the user reloads the page
  Then the header workspace switcher displays "{workspace_to_name}" as the active workspace
  And the dropdown lists all workspaces the user belongs to with the active one marked
```

**Status**: Blocked — re-checked 2026-08-17. The original `LoginPage.ts` blocker (fictional
`data-testid`s) was fixed in a later session (BK-264, real 2-step login confirmed live). Live
inspection via playwright-cli against staging (2026-08-17) found a separate, still-open blocker:
`components/layout/WorkspaceSwitcher.tsx` has ZERO `data-testid` attributes on the trigger
button, dropdown, or list items — only text-based role locators are available, and the active
item is marked by a decorative check-mark SVG with no `aria-current`. Tracked in **BK-328**
("Add data-testid attributes to WorkspaceSwitcher component") — Tech Story, Status **To Do**
as of 2026-08-17. Do not automate BK-253 until BK-328 lands.

## Acceptance Criteria

- [x] BK-250 automated and passing (BK-316 closed 2026-08-17, retested green against staging)
- [x] BK-251 automated and passing
- [x] BK-252 automated and passing, DB triforce assertion included
- [ ] BK-253 automated and passing, real UI selectors captured (blocked on LoginPage.ts fix)
- [ ] Tests pass on `staging` (already the only env with real data for this ticket)
