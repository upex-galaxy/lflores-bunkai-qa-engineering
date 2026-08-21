---
tc_id: BK-561
story: BK-498
priority: high
roi: 16.0
outcome: Candidate
labels: [regression, automation-candidate, integration, high]
---

# BK-561: TC12: should accept writes across all authoring families given a PAT scoped exactly atc:write

## Preconditions
- `{atc_write_pat}` exists — a PAT scoped exactly `atc:write`

## Action
Perform one write per authoring resource family, using `{atc_write_pat}` as the Bearer token:

| family | endpoint |
|---|---|
| User Stories | `POST /modules/{module_id}/user-stories` |
| Acceptance Criteria | `POST /user-stories/{id}/acceptance-criteria` |
| Environments | `POST /projects/{project_id}/environments` |
| Milestones | `POST /projects/{project_id}/milestones` |
| Imports | `POST /imports` |

## Expected Results
- Response status is `2xx` on every row above
- A DB side-effect row is created for each family
- These created rows become TC13's read fixtures

## Gherkin
```gherkin
@high @regression @automation-candidate @BK-498
Scenario Outline: should accept a write to <family> given a PAT scoped exactly atc:write
  Given a PAT scoped exactly atc:write exists ({atc_write_pat})
  When the user sends <endpoint> using the atc:write-scoped token
  Then the response status is a 2xx success
  And a <family> row is created as a side effect

  Examples:
    | family               | endpoint                                          |
    | User Stories          | POST /modules/{module_id}/user-stories           |
    | Acceptance Criteria   | POST /user-stories/{id}/acceptance-criteria      |
    | Environments           | POST /projects/{project_id}/environments        |
    | Milestones              | POST /projects/{project_id}/milestones          |
    | Imports                  | POST /imports                                    |
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
