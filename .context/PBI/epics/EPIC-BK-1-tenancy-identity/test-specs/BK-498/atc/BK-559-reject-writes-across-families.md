# ATC BK-559 (TC11) — rejectWritesAcrossFamilies

**Component**: `AuthoringSweepApi` · **Fixture**: `{ api }` · **File**: `tests/integration/authoring/rejectWritesAcrossAuthoringFamilies.test.ts`

Parametrized artifact — one ATC, 5 internal rows (Part 2.5 artifact economy).

## Signature
```typescript
@atc('BK-559')
async rejectWritesAcrossFamilies(moduleId: string, projectId: string): Promise<Array<{ family: string, response: APIResponse }>>
```

## Rows
| Family | Endpoint |
|---|---|
| User Stories | `POST /modules/{module_id}/user-stories` |
| Acceptance Criteria | `POST /user-stories/{id}/acceptance-criteria` (use a discovered/fixed US id under `moduleId`) |
| Environments | `POST /projects/{project_id}/environments` |
| Milestones | `POST /projects/{project_id}/milestones` |
| Imports | `POST /imports` |

## Precondition (test-level)
- `authenticateSuccessfully()`
- `tokens.mintPatWithScopes({ scopes: ['atc:read'], workspace_id })`
- `sweep.setAuthToken(pat.token)`

## Action
Attempt a minimal-valid write on each of the 5 rows above, using the `atc:read` PAT.

## Fixed assertions (inside ATC, per row)
- `response.status() === 403` on every row
- The Imports row's 403 is expected behavior (ratified 2026-08-19 AI PO decision), not
  a defect — do not fail the ATC differently for that row

## Test-level assertions
None beyond the per-row fixed assertions.

## Source TC
`test-cases/BK-559-tc11-reject-writes-atc-read-only.md`
