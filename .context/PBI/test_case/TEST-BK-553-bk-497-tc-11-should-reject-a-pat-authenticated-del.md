# TEST: BK-497: TC-11: should reject a PAT-authenticated DELETE to the token-revocation route

**Jira Key:** [BK-553](https://jira.upexgalaxy.com/browse/BK-553)
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

- Caller holds any valid minted PAT
- A target token exists to attempt revoking

### Action

Send `DELETE /api/v1/tokens/{token_id}` using Bearer PAT auth.

### Expected Results (assertions of this TC — same precondition+action)

- Response status is 403
- Response message is verbatim: "Personal access tokens cannot revoke tokens. Use a browser session."
- Target token's `revoked_at` remains null (DB-confirmed)

### Gherkin (if Candidate)

```gherkin
@critical @regression @automation-candidate @BK-497
Scenario: should reject a PAT-authenticated DELETE to the token-revocation route
  Given a PAT exists with any valid scope
  And a target access token exists (id {target*token*id})
  When the user sends DELETE /api/v1/tokens/{target*token*id} using the PAT as Bearer auth
  Then the response status is 403
  And the response message is "Personal access tokens cannot revoke tokens. Use a browser session."
  And the target token's revoked_at remains null
```

## Variables

| Variable | How to obtain |
| --- | --- |
| `{any*valid*pat}` | Any minted PAT — scope-irrelevant |
| `{target*token*id}` | Any other minted token's id |

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
