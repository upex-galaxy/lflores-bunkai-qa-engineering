---
tc_id: BK-569
story: BK-498
priority: high
roi: 16.0
outcome: Candidate
labels: [regression, automation-candidate, integration, high]
---

# BK-569: TC7: should reject module creation with a membership-403 given a correctly-scoped atc:write PAT whose user is not a workspace member

## Preconditions
- PAT correctly scoped `atc:write`, bound
- The underlying user is NOT a member of the target project's workspace

## Action
Send `POST /api/v1/projects/{project_id}/modules` using that PAT.

## Expected Results
- Response status is `403` but with reason `"not_a_member"` (message differs from TC2's capability-403) — proves the gate correctly separates "wrong scope" from "not a workspace member" instead of conflating the two
- Zero DB side effect

## Gherkin
```gherkin
@high @regression @automation-candidate @BK-498
Scenario: Reject module creation with a membership-403 given a correctly-scoped atc:write PAT whose user is not a workspace member
  Given a PAT correctly scoped atc:write, bound to a workspace
  And the underlying user is NOT a member of {project_id}'s workspace
  When the user sends POST /api/v1/projects/{project_id}/modules using that PAT
  Then the response status is 403 with reason "not_a_member"
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
None — ATP validated against live code at Session Start, no discrepancies found.
