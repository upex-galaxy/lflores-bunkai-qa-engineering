---
tc_id: BK-566
story: BK-498
priority: high
roi: 16.0
outcome: Candidate
labels: [regression, automation-candidate, integration, high]
---

# BK-566: TC14: should reject reads across all authoring families given a PAT scoped exactly atc:write (write-only token)

## Preconditions
- `{atc_write_pat}` exists — a PAT scoped exactly `atc:write` (write-only, no `atc:read`)

## Action
Perform one read per authoring resource family, using `{atc_write_pat}` as the Bearer token:

| family | endpoint |
|---|---|
| User Stories | `GET /user-stories/{id}` |
| Acceptance Criteria | `GET /acceptance-criteria/{id}` |
| Environments | `GET /projects/{project_id}/environments` |
| Milestones | `GET /projects/{project_id}/milestones` |
| Imports | `GET /imports/{id}` |

## Expected Results
- Response status is `403` on every row above, including the User Stories, Acceptance Criteria, Environments, and Milestones rows
- The Imports row's `GET /imports/{id}` is also rejected with `403` for this write-only token
- **The Imports-row `403` is the ratified expected behavior from the 2026-08-19 AI Product Owner decision on BK-498's comments — NOT a regression.** A client needs BOTH `atc:write` and `atc:read` scopes to complete the full Imports lifecycle (create + poll); see TC15 for the positive control that proves this with a dual-scope token

## Gherkin
```gherkin
@high @regression @automation-candidate @BK-498
Scenario Outline: should reject a read of <family> given a PAT scoped exactly atc:write (write-only token)
  Given a PAT scoped exactly atc:write exists ({atc_write_pat}), with no atc:read scope
  When the user sends <endpoint> using the atc:write-scoped token
  Then the response status is 403

  Examples:
    | family               | endpoint                                    |
    | User Stories          | GET /user-stories/{id}                     |
    | Acceptance Criteria   | GET /acceptance-criteria/{id}              |
    | Environments           | GET /projects/{project_id}/environments   |
    | Milestones              | GET /projects/{project_id}/milestones     |
    | Imports                  | GET /imports/{id}                          |
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
