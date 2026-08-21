---
tc_id: BK-563
story: BK-498
priority: high
roi: 16.0
outcome: Candidate
labels: [regression, automation-candidate, integration, high]
---

# BK-563: TC13: should accept reads across all authoring families given a PAT scoped exactly atc:read

## Preconditions
- `{atc_read_pat}` exists — a PAT scoped exactly `atc:read`
- The rows created by TC12 (User Stories, Acceptance Criteria, Environments, Milestones, Imports) exist and are readable

## Action
Perform one read per authoring resource family, using `{atc_read_pat}` as the Bearer token:

| family | endpoint |
|---|---|
| User Stories | `GET /user-stories/{id}` |
| Acceptance Criteria | `GET /acceptance-criteria/{id}` |
| Environments | `GET /projects/{project_id}/environments` |
| Milestones | `GET /projects/{project_id}/milestones` |
| Imports | `GET /imports/{id}` |

## Expected Results
- Response status is `200` on every row above

## Gherkin
```gherkin
@high @regression @automation-candidate @BK-498
Scenario Outline: should accept a read of <family> given a PAT scoped exactly atc:read
  Given a PAT scoped exactly atc:read exists ({atc_read_pat})
  And the <family> row created by TC12 exists
  When the user sends <endpoint> using the atc:read-scoped token
  Then the response status is 200

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
