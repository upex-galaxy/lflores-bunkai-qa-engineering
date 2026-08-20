# TEST: BK-497: TC-10: should reject a PAT-authenticated POST to the token-issuance route

**Jira Key:** [BK-552](https://jira.upexgalaxy.com/browse/BK-552)
**Status:** In Design
**Components:** Tenancy & Identity

---

## Test Description

## Related Story

BK-497 — PAT | Require every API route to declare its capability posture

## Priority / ROI

- Priority: Critical
- ROI score: N/A (ROI scoring not computed this pass — verdict set directly by QA judgment; proves the one real behavioural change in this Story)
- Outcome: Candidate

## Prior bugs covered

- (none)

## Test Design

### Preconditions

- Caller holds any valid minted PAT (rejection is channel-based, not scope-based)

### Action

Send `POST /api/v1/tokens` using Bearer PAT auth.

### Expected Results (assertions of this TC — same precondition+action)

- Response status is 403
- Response message is verbatim: "Personal access tokens cannot issue tokens. Use a browser session."
- Zero rows created for the attempted token name (DB-confirmed)

### Gherkin (if Candidate)

```gherkin
@critical @regression @automation-candidate @BK-497
Scenario: should reject a PAT-authenticated POST to the token-issuance route
  Given a PAT exists with any valid scope
  When the user sends POST /api/v1/tokens using that PAT as Bearer auth
  Then the response status is 403
  And the response message is "Personal access tokens cannot issue tokens. Use a browser session."
  And no access_tokens row is created for the attempted name
```

## Variables

| Variable | How to obtain |
| --- | --- |
| `{any*valid*pat}` | Any minted PAT — scope-irrelevant |

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
