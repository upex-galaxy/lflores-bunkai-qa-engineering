---
tc_id: BK-568
story: BK-498
priority: high
roi: 16.0
outcome: Candidate
labels: [regression, automation-candidate, integration, high]
---

# BK-568: TC15: should complete a full import lifecycle (create then poll) successfully given a PAT scoped both atc:write and atc:read

## Preconditions
- `{dual_scope_pat}` exists — a PAT scoped with BOTH `atc:write` and `atc:read`

## Action
Send `POST /api/v1/imports` (queues the import job) using `{dual_scope_pat}`, then poll `GET /api/v1/imports/{id}` (using the id from the create response) using the same dual-scope token, repeating until the job completes.

## Expected Results
- `POST /api/v1/imports` returns `202 Accepted` with a job id
- `GET /api/v1/imports/{id}` returns `200 OK` once the job has completed
- This is the positive control proving TC11's and TC14's Import-family `403` rows are expected behavior, not a defect — a client needs BOTH `atc:write` and `atc:read` scopes for the full import workflow (create + poll), per the ratified 2026-08-19 AI Product Owner decision on BK-498's comments

## Gherkin
```gherkin
@high @regression @automation-candidate @BK-498
Scenario: should complete a full import lifecycle (create then poll) successfully given a PAT scoped both atc:write and atc:read
  Given a PAT scoped with both atc:write and atc:read exists ({dual_scope_pat})
  When the user sends POST /api/v1/imports using the dual-scope token
  Then the response status is 202 with a job id
  When the user polls GET /api/v1/imports/{id} using the dual-scope token until the job completes
  Then the response status is 200
  And this proves a client needs both atc:write and atc:read to complete the Imports workflow, confirming the 403s seen in TC11/TC14 for the Imports family are expected, not a defect
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
