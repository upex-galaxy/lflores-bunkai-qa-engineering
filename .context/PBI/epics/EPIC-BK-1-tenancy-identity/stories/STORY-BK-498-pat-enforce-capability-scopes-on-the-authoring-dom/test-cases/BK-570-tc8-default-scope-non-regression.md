---
tc_id: BK-570
story: BK-498
priority: high
roi: 16.0
outcome: Candidate
labels: [regression, automation-candidate, integration, high]
---

# BK-570: TC8: should continue succeeding on both read and write given a default-scoped PAT

## Preconditions
- Default-scope PAT (existing `.auth/tokens.env` OWNER role token — `atc:read` + `atc:write` + `run:execute`, `DEFAULT_PAT_SCOPES`)

## Action
Send `POST /api/v1/projects/{project_id}/modules` AND `GET /api/v1/modules/{module_id}/user-stories`, both with the same default-scope token.

## Expected Results
- `201` on the write call
- `200` on the read call — non-regression control confirming default-scope tokens (the common case) lose nothing from this Story's enforcement change

## Gherkin
```gherkin
@high @regression @automation-candidate @BK-498
Scenario: Continue succeeding on both read and write given a default-scoped PAT
  Given a default-scope PAT with atc:read, atc:write and run:execute
  When the user sends POST /api/v1/projects/{project_id}/modules using that token
  Then the response status is 201
  When the user sends GET /api/v1/modules/{module_id}/user-stories using that same token
  Then the response status is 200
```

## Variables
| Variable | Description | How to obtain |
|---|---|---|
| `{project_id}` | Target project UUID | `BK264 Defect Triage` project, id `2fee236f-1246-40c4-bfc4-d332287f9548` (staging DB, `staging-dbhub`) |
| `{workspace_id}` | Bound workspace UUID | `BK-264 QA Sandbox`, id `6646f244-a28c-441e-8486-9af33bdb5c11` |
| `{module_id}` | Existing module UUID (for GET routes) | `Defect Triage Module`, id `175f8a08-20b9-4c96-a21a-e02dcae2837e` |
| `{atc_write_pat}` | Freshly minted PAT scoped exactly `atc:write` | `POST /api/v1/auth/signin` (cookie jar) -> `POST /api/v1/tokens` with `scopes: ["atc:write"]` + `workspace_id` |
| `{atc_read_pat}` | Freshly minted PAT scoped exactly `atc:read` | same mint flow, `scopes: ["atc:read"]` |

## Refinement Notes
None — ATP validated against live code at Session Start, no discrepancies found.
