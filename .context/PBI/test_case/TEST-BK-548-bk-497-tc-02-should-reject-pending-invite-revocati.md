# TEST: BK-497: TC-02: should reject pending-invite revocation when the PAT lacks workspace:admin

**Jira Key:** [BK-548](https://jira.upexgalaxy.com/browse/BK-548)
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

- Caller holds a PAT scoped `atc:write` + `run:execute` (no `workspace:admin`)
- A pre-existing pending invite exists in a workspace the PAT is bound to

### Action

Send `DELETE /api/v1/workspaces/{workspace*id}/invites/{invite*id}` using that PAT.

### Expected Results (assertions of this TC — same precondition+action)

- Response status is 403
- Response message indicates the missing `workspace:admin` capability
- The invite row is unchanged (`revoked_at` still null, DB-confirmed)

### Gherkin (if Candidate)

```gherkin
@critical @regression @automation-candidate @BK-497
Scenario: should reject pending-invite revocation when the PAT lacks workspace:admin
  Given a PAT exists scoped to "atc:write" and "run:execute" only
  And a pending invite exists in a workspace the PAT is bound to
  When the user sends DELETE /api/v1/workspaces/{workspace*id}/invites/{invite*id} using that PAT
  Then the response status is 403
  And the response indicates the missing "workspace:admin" capability
  And the invite's revoked_at remains null
```

## Variables

| Variable | How to obtain |
| --- | --- |
| `{workspace_id}` | An existing workspace the PAT-holder belongs to |
| `{invite*id}` | Created via a session-authenticated `POST /api/v1/workspaces/{workspace*id}/invites` fixture step before the test action |
| `{pat*write*execute}` | Minted via `POST /api/v1/tokens` with `scopes: ["atc:write","run:execute"]` |

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
