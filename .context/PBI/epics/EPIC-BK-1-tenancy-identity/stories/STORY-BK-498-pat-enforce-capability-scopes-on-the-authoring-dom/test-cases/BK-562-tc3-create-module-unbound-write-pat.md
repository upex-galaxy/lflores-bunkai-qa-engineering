---
tc_id: BK-562
story: BK-498
priority: high
roi: 16.0
outcome: Candidate
labels: [regression, automation-candidate, integration, high]
---

# BK-562: TC3: should create module successfully given an unbound atc:write PAT held by a real workspace member

## Preconditions
- PAT scoped `atc:write`, `workspace_id = null` (unbound at mint time — omit `workspace_id` in the `POST /api/v1/tokens` call)
- The underlying user IS an active member of `{project_id}`'s workspace

## Action
Send `POST /api/v1/projects/{project_id}/modules` using the unbound token.

## Expected Results
- Response status is `201` — the capability check does not depend on token-workspace binding, only on capability + the user's real membership

## Gherkin
```gherkin
@high @regression @automation-candidate @BK-498
Scenario: Create a module successfully with an unbound atc:write PAT held by a real workspace member
  Given a PAT scoped atc:write minted with workspace_id omitted (unbound)
  And the underlying user is an active member of {project_id}'s workspace
  When the user sends POST /api/v1/projects/{project_id}/modules using the unbound token
  Then the response status is 201
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
