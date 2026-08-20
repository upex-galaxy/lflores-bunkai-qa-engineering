# TEST: BK-497: TC-18: should reject a workspace-admin action when the PAT is bound to a different workspace

**Jira Key:** [BK-551](https://jira.upexgalaxy.com/browse/BK-551)
**Status:** In Design
**Components:** Tenancy & Identity

---

## Test Description

## Related Story

BK-497 — PAT | Require every API route to declare its capability posture

## Priority / ROI

- Priority: Critical
- ROI score: N/A (ROI scoring not computed this pass — verdict set directly by QA judgment; non-regression guard on all 87 migrated call sites)
- Outcome: Candidate

## Prior bugs covered

- (none)

## Test Design

### Preconditions

- A PAT exists scoped `workspace:admin`, bound to workspace A
- A second workspace B exists that the caller is NOT the admin-PAT's bound workspace for

### Action

Send `PATCH /api/v1/workspaces/{workspace*b*id}` using the workspace-A-bound PAT.

### Expected Results (assertions of this TC — same precondition+action)

- Response status is 403
- Response message indicates the token is scoped to a different workspace (verbatim: "This token is scoped to a different workspace." — confirmed in Stage 2 execution)

### Gherkin (if Candidate)

```gherkin
@critical @regression @automation-candidate @BK-497
Scenario: should reject a workspace-admin action when the PAT is bound to a different workspace
  Given a PAT exists scoped to "workspace:admin" and bound to workspace {workspace*a*id}
  And a second workspace {workspace*b*id} exists
  When the user sends PATCH /api/v1/workspaces/{workspace*b*id} using that PAT
  Then the response status is 403
  And the response indicates the token is scoped to a different workspace
```

## Variables

| Variable | How to obtain |
| --- | --- |
| `{workspace*a*id}` | The PAT's bound workspace |
| `{workspace*b*id}` | Any other workspace on staging (does not require the caller to be a member) |

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

This TC substitutes for the ATP's literal TC-03/AC-06 scenario (PAT scoped `workspace:admin` with NO resolvable workspace binding), which could not be live-reproduced or automated: minting such a token is blocked by design (`assertTokenIssuanceAuthorized` in `lib/api/pat.ts`, BK-135/ADR-0005), the QA DB role is read-only (cannot simulate the legacy unbound state), and no non-owner admin seed identity with 2+ workspace memberships exists in `.env` to route around the sole-owner membership-removal block. TC-18 exercises the sibling branch of the same guard function (`assertWorkspaceContext`) and is fully automatable today. AC-06's literal scenario stays Deferred (see acceptance-test-results.md Observations #1) and remains covered by the dev's own automated `workspace-context` suite.

---

## Related Issues

- tests: [BK-497](https://jira.upexgalaxy.com/browse/BK-497) - PAT | Require every API route to declare its capability posture

---

## Metadata

- **Created:** 8/20/2026
- **Updated:** 8/20/2026
- **Reporter:** Luis Eduardo Flores Villarroel
- **Assignee:** Luis Eduardo Flores Villarroel
- **Labels:** automation-candidate, critical, epic-bk-1, integration, regression

---

_Synced from Jira by sync-jira-issues_
