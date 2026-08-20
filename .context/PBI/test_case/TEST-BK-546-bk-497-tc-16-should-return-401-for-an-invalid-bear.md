# TEST: BK-497: TC-16: should return 401 for an invalid Bearer token before the cookie-only posture check runs

**Jira Key:** [BK-546](https://jira.upexgalaxy.com/browse/BK-546)
**Status:** In Design
**Components:** Tenancy & Identity

---

## Test Description

## Related Story

BK-497 — PAT | Require every API route to declare its capability posture

## Priority / ROI

- Priority: Medium
- Outcome: Candidate

## Prior bugs covered

- (none) if first time

## Test Design

### Preconditions

- An invalid or malformed Bearer token string (never minted, or malformed)

### Action

The caller sends `POST /api/v1/tokens` using the invalid Bearer token.

### Expected Results (assertions of this TC — same precondition+action)

- Response status is 401 (NOT 403)
- Response message is "Invalid token."
- Proves identity resolution (`resolveIdentity`) runs and fails BEFORE the `cookie-only` posture check — the auth-resolution-ordering property the ACs are silent on

### Gherkin (if Candidate)

```gherkin
@medium @regression @automation-candidate @BK-497
Scenario: should return 401 for an invalid Bearer token before the cookie-only posture check runs
  Given an invalid or malformed Bearer token
  When the user sends POST /api/v1/tokens using that invalid token
  Then the response status is 401
  And the response message is "Invalid token."
```

## Variables

| Variable | How to obtain |
| --- | --- |
| `{garbage_token}` | Any syntactically-invalid or non-existent token string |

## Implementation Code (filled by test-automation)

| Layer | File |
| --- | --- |
| API component |  |
| UI component |  |
| Test file |  |
| Fixture |  |

## Architecture

API — follows KATA layers.

## Available Test IDs (UI)

- N/A (API-only TC)

## Refinement Notes

Originated as an Error Guessing charter (TC-16 in the ATP) rather than an AC-derived case — the auth-resolution-vs-posture-check ordering was not specified in any AC, but is a real, deterministic, cheap-to-assert property worth protecting against regression (explicitly recommended in acceptance-test-results.md § Recommendations).

---

## Related Issues

- tests: [BK-497](https://jira.upexgalaxy.com/browse/BK-497) - PAT | Require every API route to declare its capability posture

---

## Metadata

- **Created:** 8/20/2026
- **Updated:** 8/20/2026
- **Reporter:** Luis Eduardo Flores Villarroel
- **Assignee:** Luis Eduardo Flores Villarroel
- **Labels:** automation-candidate, integration, medium, regression

---

_Synced from Jira by sync-jira-issues_
