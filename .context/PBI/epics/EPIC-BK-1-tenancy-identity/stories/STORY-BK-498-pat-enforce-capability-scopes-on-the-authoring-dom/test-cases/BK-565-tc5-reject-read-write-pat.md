---
tc_id: BK-565
story: BK-498
priority: medium
roi: 12.0
outcome: Candidate
labels: [regression, automation-candidate, integration, medium]
---

# BK-565: TC5: should reject a read request with 403 given a PAT scoped only atc:write

## Preconditions
- `{atc_write_pat}`

## Action
Send `GET /api/v1/modules/{module_id}/user-stories` using `{atc_write_pat}`.

## Expected Results
- Response status is `403` ("Missing required capability: atc:read") — read-mirror of TC2, proves the read gate is `atc:read` specifically, not "any authenticated capability"

## Gherkin
```gherkin
@medium @regression @automation-candidate @BK-498
Scenario: Reject a read request with 403 given a PAT scoped only atc:write
  Given a PAT `{atc_write_pat}`
  When the user sends GET /api/v1/modules/{module_id}/user-stories using `{atc_write_pat}`
  Then the response status is 403 with message "Missing required capability: atc:read"
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
