---
tc_id: BK-556
story: BK-498
priority: critical
roi: 25.0
outcome: Candidate
labels: [regression, automation-candidate, integration, critical]
---

# BK-556: TC1: should create module successfully given a PAT scoped exactly atc:write

## Preconditions
- `{atc_write_pat}` bound to `{workspace_id}`
- User is an active member of `{project_id}`'s workspace

## Action
Send `POST /api/v1/projects/{project_id}/modules` with a valid module payload, using `{atc_write_pat}`.

## Expected Results
- Response status is `201`
- The created module row exists in the `modules` table

## Gherkin
```gherkin
@critical @regression @automation-candidate @BK-498
Scenario: Create a module successfully with a PAT scoped exactly atc:write
  Given a PAT `{atc_write_pat}` bound to `{workspace_id}`
  And the underlying user is an active member of `{project_id}`'s workspace
  When the user sends POST /api/v1/projects/{project_id}/modules with a valid module payload using `{atc_write_pat}`
  Then the response status is 201
  And the created module row exists in the modules table
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
