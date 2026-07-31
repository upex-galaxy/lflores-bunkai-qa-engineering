---
tc_id: BK-253
story: BK-6
priority: high
roi: 6.0
outcome: Candidate
labels: [regression, automation-candidate, e2e, epic-BK-1]
---

# BK-253: TC4: should display the newly active workspace in the header switcher after switch and page reload

## Preconditions
- User has already switched the active workspace to `{workspace_to_id}` via the API (TC1 precondition/action)

## Action
User reloads the page (full page reload)

## Expected Results
- Header workspace switcher displays `{workspace_to_name}` as the active workspace, before and after reload
- Dropdown lists all workspaces the user belongs to, with the active one visually marked

## Gherkin
```gherkin
@high @regression @automation-candidate @BK-6
Scenario: should display the newly active workspace in the header switcher after switch and page reload
  Given a user has switched the active workspace to "{workspace_to_id}" via the API
  When the user reloads the page
  Then the header workspace switcher displays "{workspace_to_name}" as the active workspace
  And the dropdown lists all workspaces the user belongs to with the active one marked
```

## Variables
| Variable | How to obtain |
|----------|---------------|
| `{workspace_to_id}` / `{workspace_to_name}` | Target workspace from the TC1 fixture (same switch precondition) |

## Refinement Notes
Navigation target after switch is `/projects`, not `/home` as the original spec assumed — accepted, spec was stale (PO decision 2026-06-06). Assert against `/projects`. Switcher requires >=1 project in the workspace to render (OBS-002, non-bug) — fixture must ensure both workspaces have a project. No `data-testid` captured yet for the switcher component — `test-automation` must inspect the source before automating.
