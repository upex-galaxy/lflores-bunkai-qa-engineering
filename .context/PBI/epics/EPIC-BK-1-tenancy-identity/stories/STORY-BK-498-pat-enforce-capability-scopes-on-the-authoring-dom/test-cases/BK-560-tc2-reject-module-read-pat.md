---
tc_id: BK-560
story: BK-498
priority: critical
roi: 25.0
outcome: Candidate
labels: [regression, automation-candidate, integration, critical]
---

# BK-560: TC2: should reject module creation with 403 and no side effect given a PAT scoped exactly atc:read

## Preconditions
- `{atc_read_pat}` bound to `{workspace_id}`

## Action
Send `POST /api/v1/projects/{project_id}/modules` using `{atc_read_pat}`.

## Expected Results
- Response status is `403 forbidden` ("Missing required capability: atc:write")
- Zero rows inserted into `modules` for this attempt (DB cross-check)

## Gherkin
```gherkin
@critical @regression @automation-candidate @BK-498
Scenario: Reject module creation with 403 and no side effect given a PAT scoped exactly atc:read
  Given a PAT `{atc_read_pat}` bound to `{workspace_id}`
  When the user sends POST /api/v1/projects/{project_id}/modules using `{atc_read_pat}`
  Then the response status is 403 with message "Missing required capability: atc:write"
  And zero rows are inserted into the modules table for this attempt
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
None — ATP validated against live code at Session Start, no discrepancies found. Note: Jira priority field on this instance has no "Critical" value; mapped to the closest equivalent "Highest" (scheme is Highest/High/Medium/Low/Lowest). The `critical` label and ROI/priority narrative are preserved as specified.
