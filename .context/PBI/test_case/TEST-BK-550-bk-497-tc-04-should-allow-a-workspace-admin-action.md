# TEST: BK-497: TC-04: should allow a workspace-admin action when the PAT is correctly scoped and bound to the target workspace

**Jira Key:** [BK-550](https://jira.upexgalaxy.com/browse/BK-550)
**Status:** In Design
**Components:** Tenancy & Identity

---

## Test Description

## Related Story

BK-497 — PAT | Require every API route to declare its capability posture

## Priority / ROI

- Priority: High
- ROI score: N/A (ROI scoring not computed this pass — verdict set directly by QA judgment; positive control counterweight to TC-01/02/18)
- Outcome: Candidate

## Prior bugs covered

- (none)

## Test Design

### Preconditions

- Caller holds a PAT scoped `workspace:admin`, bound to the target workspace

### Action

Send `PATCH /api/v1/workspaces/{workspace_id}` (e.g. update the workspace name to its own current value — a no-op-equivalent write) using that PAT.

### Expected Results (assertions of this TC — same precondition+action)

- Response status is 200
- Workspace reflects the update

### Gherkin (if Candidate)

```gherkin
@high @regression @automation-candidate @BK-497
Scenario: should allow a workspace-admin action when the PAT is correctly scoped and bound
  Given a PAT exists scoped to "workspace:admin" and bound to workspace {workspace_id}
  When the user sends PATCH /api/v1/workspaces/{workspace_id} using that PAT
  Then the response status is 200
  And the workspace reflects the update
```

## Variables

| Variable | How to obtain |
| --- | --- |
| `{workspace_id}` | An existing workspace the caller belongs to |
| `{pat*admin*bound}` | Minted via `POST /api/v1/tokens` with `scopes: ["workspace:admin"]` while the caller belongs to `{workspace_id}` |

## Implementation Code (filled by test-automation)

| Layer | File |
| --- | --- |
| API component | (empty — filled by test-automation) |
| UI component | (empty — filled by test-automation) |
| Test file | (empty — filled by test-automation) |
| Fixture | (empty — filled by test-automation) |

## Architecture

API — follows KATA layers (`ApiBase` / dedicated `YourApi` component, no browser fixture).

## Available Test IDs (UI)

N/A — API-level test, no UI selectors.

## Refinement Notes

(none)

---

## Related Issues

- tests: [BK-497](https://jira.upexgalaxy.com/browse/BK-497) - PAT | Require every API route to declare its capability posture

---

## Metadata

- **Created:** 8/20/2026
- **Updated:** 8/20/2026
- **Reporter:** Luis Eduardo Flores Villarroel
- **Assignee:** Luis Eduardo Flores Villarroel
- **Labels:** automation-candidate, epic-bk-1, high, integration, regression

---

_Synced from Jira by sync-jira-issues_
