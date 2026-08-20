# TEST: BK-497: TC-12: should allow a PAT-authenticated GET to the token-listing route

**Jira Key:** [BK-543](https://jira.upexgalaxy.com/browse/BK-543)
**Status:** In Design
**Components:** Tenancy & Identity

---

## Test Description

## Related Story

BK-497 — PAT | Require every API route to declare its capability posture

## Priority / ROI

- Priority: High
- Outcome: Candidate

## Prior bugs covered

- (none) if first time

## Test Design

### Preconditions

- Caller holds any valid minted PAT (scope-irrelevant — the rejection is channel-based, not scope-based)

### Action

The caller sends `GET /api/v1/tokens` using the PAT as Bearer auth.

### Expected Results (assertions of this TC — same precondition+action)

- Response status is 200
- Response body lists only the caller's own tokens (RLS-scoped)
- Proves GET was NOT swept into the `cookie-only` lift (positive control)

### Gherkin (if Candidate)

```gherkin
@high @regression @automation-candidate @BK-497
Scenario: should allow a PAT-authenticated GET to the token-listing route
  Given a PAT exists with any valid scope
  When the user sends GET /api/v1/tokens using that PAT as Bearer auth
  Then the response status is 200
  And the response lists only the caller's own tokens
```

## Variables

| Variable | How to obtain |
| --- | --- |
| `{any*valid*pat}` | Any minted PAT via `POST /api/v1/tokens` — scope-irrelevant for this TC |

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
- **Labels:** automation-candidate, high, integration, regression

---

_Synced from Jira by sync-jira-issues_
