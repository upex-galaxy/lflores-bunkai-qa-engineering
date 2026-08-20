# TEST: BK-497: TC-01: should reject invite creation when the PAT is scoped only to atc:read

**Jira Key:** [BK-544](https://jira.upexgalaxy.com/browse/BK-544)
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

- Caller holds a PAT scoped exactly `atc:read`, minted via `POST /api/v1/tokens` (session-authenticated)

### Action

Send `POST /api/v1/workspaces/{workspace_id}/invites` using that PAT as Bearer auth.

### Expected Results (assertions of this TC — same precondition+action)

- Response status is 403
- Response message indicates the missing `workspace:admin` capability
- Zero rows created in `workspace_invites` for the target email (DB-confirmed)

### Gherkin (if Candidate)

```gherkin
@critical @regression @automation-candidate @BK-497
Scenario: should reject invite creation when the PAT is scoped only to atc:read
  Given a PAT exists scoped exactly to "atc:read"
  When the user sends POST /api/v1/workspaces/{workspace_id}/invites using that PAT
  Then the response status is 403
  And the response indicates the missing "workspace:admin" capability
  And no workspace_invites row is created for the target email
```

## Variables

| Variable | How to obtain |
| --- | --- |
| `{workspace_id}` | An existing workspace the PAT-holder belongs to |
| `{pat*atc*read}` | Minted via `POST /api/v1/tokens` with `scopes: ["atc:read"]` |

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
- **Labels:** automation-candidate, critical, epic-bk-1, integration, regression

---

_Synced from Jira by sync-jira-issues_
