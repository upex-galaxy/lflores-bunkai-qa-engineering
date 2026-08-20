# TEST: BK-497: TC-13: should allow session-authenticated calls to all three token routes given the cookie-only lift

**Jira Key:** [BK-545](https://jira.upexgalaxy.com/browse/BK-545)
**Status:** In Design
**Components:** Tenancy & Identity

---

## Test Description

## Related Story

BK-497 — PAT | Require every API route to declare its capability posture

## Priority / ROI

- Priority: Critical
- Outcome: Candidate

## Prior bugs covered

- (none) if first time

## Test Design

### Preconditions

- Caller has an active staging session (cookie-authenticated, not Bearer)

### Action

The caller issues a token (`POST /api/v1/tokens`), lists tokens (`GET /api/v1/tokens`), and revokes a token (`DELETE /api/v1/tokens/{id}`) — all via the session cookie.

### Expected Results (assertions of this TC — same precondition+action)

- `POST /api/v1/tokens` returns 201 (issue succeeds)
- `GET /api/v1/tokens` returns 200 (list succeeds)
- `DELETE /api/v1/tokens/{id}` returns 204 (revoke succeeds)
- All three routes behave exactly as they did before the `cookie-only` lift — session traffic is entirely unaffected by the lift

### Gherkin (if Candidate)

```gherkin
@critical @regression @automation-candidate @BK-497
Scenario: should allow session-authenticated calls to all three token routes
  Given the user has an active session (cookie-authenticated)
  When the user sends POST /api/v1/tokens using the session cookie
  Then the response status is 201
  When the user sends GET /api/v1/tokens using the session cookie
  Then the response status is 200
  When the user sends DELETE /api/v1/tokens/{issued*token*id} using the session cookie
  Then the response status is 204
```

## Variables

| Variable | How to obtain |
| --- | --- |
| `{issued*token*id}` | Captured from the `POST /api/v1/tokens` response in the same test flow |

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
- **Labels:** automation-candidate, critical, integration, regression

---

_Synced from Jira by sync-jira-issues_
