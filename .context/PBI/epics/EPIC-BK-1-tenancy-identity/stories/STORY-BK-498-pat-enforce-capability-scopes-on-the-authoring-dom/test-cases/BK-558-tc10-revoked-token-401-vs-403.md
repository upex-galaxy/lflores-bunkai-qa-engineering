---
tc_id: BK-558
story: BK-498
priority: medium
roi: 12.0
outcome: Candidate
labels: [regression, automation-candidate, integration, medium]
---

# BK-558: TC10: should return 401 for a revoked atc:write token, distinct from the 403 an under-scoped-but-valid token receives

## Preconditions
- `{revoked_atc_write_pat}` exists — an `atc:write`-scoped PAT that was minted then immediately revoked

## Action
Send `POST /api/v1/projects/{project_id}/modules` using the revoked token as the Bearer token.

## Expected Results
- Response status is `401 Unauthorized`
- Response body indicates `Invalid token.`
- This is a distinct failure surface from the valid-but-under-scoped `403` seen in TC2/TC5 — it proves token-revocation is checked before the capability gate

## Gherkin
```gherkin
@medium @regression @automation-candidate @BK-498
Scenario: should return 401 for a revoked atc:write token, distinct from the 403 an under-scoped-but-valid token receives
  Given a revoked atc:write PAT exists ({revoked_atc_write_pat}), minted then immediately revoked
  When the user sends POST /api/v1/projects/{project_id}/modules using the revoked token
  Then the response status is 401
  And the response indicates "Invalid token.", distinct from the 403 an under-scoped-but-valid token would receive
```

## Variables
| Variable | Description | How to obtain |
|---|---|---|
| `{project_id}` | Target project UUID | `BK264 Defect Triage` project, id `2fee236f-1246-40c4-bfc4-d332287f9548` (staging DB, `staging-dbhub`) |
| `{workspace_id}` | Bound workspace UUID | `BK-264 QA Sandbox`, id `6646f244-a28c-441e-8486-9af33bdb5c11` |
| `{module_id}` | Existing module UUID | `Defect Triage Module`, id `175f8a08-20b9-4c96-a21a-e02dcae2837e` |
| `{atc_write_pat}` | Freshly minted PAT scoped exactly `atc:write` | `POST /api/v1/auth/signin` (cookie jar) -> `POST /api/v1/tokens` with `scopes: ["atc:write"]` + `workspace_id` |
| `{atc_read_pat}` | Freshly minted PAT scoped exactly `atc:read` | same mint flow, `scopes: ["atc:read"]` |
| `{revoked_atc_write_pat}` | A `atc:write` PAT minted then immediately revoked | mint as above, then `DELETE /api/v1/tokens/{id}` cookie-authenticated |
| `{dual_scope_pat}` | PAT with both `atc:write` + `atc:read` | mint with `scopes: ["atc:write","atc:read"]`, or reuse an existing default-scope `.auth/tokens.env` token |

## Refinement Notes
None — ATP validated against live code at Session Start, no discrepancies found.
