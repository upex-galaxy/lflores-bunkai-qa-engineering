---
tc_id: BK-567
story: BK-498
priority: high
roi: 16.0
outcome: Candidate
labels: [regression, automation-candidate, integration, high]
---

# BK-567: TC6: should return 401 unauthenticated when no token is presented, distinct from the 403 capability rejection

## Preconditions
- No `Authorization` header at all (no token, no session)

## Action
Send `POST /api/v1/projects/{project_id}/modules` with the `Authorization` header omitted entirely.

## Expected Results
- Response status is `401 unauthorized` ("Authentication required.") — distinct failure surface from the capability `403` in TC2/TC5 (absent credential is not the same defect class as under-scoped credential)

## Gherkin
```gherkin
@high @regression @automation-candidate @BK-498
Scenario: Return 401 unauthenticated when no token is presented, distinct from the 403 capability rejection
  Given no Authorization header is present on the request
  When the user sends POST /api/v1/projects/{project_id}/modules with no Authorization header
  Then the response status is 401 with message "Authentication required."
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
