---
tc_id: BK-564
story: BK-498
priority: high
roi: 16.0
outcome: Candidate
labels: [regression, automation-candidate, integration, high]
---

# BK-564: TC4: should list user stories successfully given a PAT scoped atc:read

## Preconditions
- `{atc_read_pat}`

## Action
Send `GET /api/v1/modules/{module_id}/user-stories` using `{atc_read_pat}`.

## Expected Results
- Response status is `200` with the requested User Stories list — proves the gate is capability-based, not resource-type-based

## Gherkin
```gherkin
@high @regression @automation-candidate @BK-498
Scenario: List user stories successfully given a PAT scoped atc:read
  Given a PAT `{atc_read_pat}`
  When the user sends GET /api/v1/modules/{module_id}/user-stories using `{atc_read_pat}`
  Then the response status is 200
  And the response contains the requested User Stories list
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
