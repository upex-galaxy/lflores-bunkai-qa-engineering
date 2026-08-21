---
tc_id: BK-557
story: BK-498
priority: critical
roi: 25.0
outcome: Candidate
labels: [regression, automation-candidate, integration, critical]
---

# BK-557: TC9: should create module successfully via an authenticated browser session regardless of any PAT scope restriction

## Preconditions
- An authenticated browser session exists (cookie set from `POST /api/v1/auth/signin`)
- No PAT is involved in the request at all

## Action
Send `POST /api/v1/projects/{project_id}/modules` using the browser session cookie, not a PAT.

## Expected Results
- Response status is `201 Created`
- The module is created successfully
- Browser sessions always carry the full capability set and are never narrowed like a PAT can be — this is the regression control that matters most, since it is the most common real-world request shape

## Gherkin
```gherkin
@critical @regression @automation-candidate @BK-498
Scenario: should create a module successfully via an authenticated browser session regardless of any PAT scope restriction
  Given an authenticated browser session exists, established via a cookie from POST /api/v1/auth/signin, with no PAT involved
  When the user sends POST /api/v1/projects/{project_id}/modules using the session cookie
  Then the response status is 201
  And the module is created successfully, since browser sessions always carry the full capability set and are never narrowed like a PAT can be
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
None — ATP validated against live code at Session Start, no discrepancies found. Note: Jira priority field on this instance has no "Critical" value; mapped to the closest equivalent "Highest" (scheme is Highest/High/Medium/Low/Lowest). The `critical` label and ROI/priority narrative are preserved as specified.
