# ATC BK-563 (TC13) — acceptReadsAcrossFamilies

**Component**: `AuthoringSweepApi` · **Fixture**: `{ api }` · **File**: `tests/integration/authoring/enforceAuthoringWriteReadSweep.test.ts`

Parametrized artifact — 5 rows. **Consumes BK-561's returned row refs (parameter, not
self-created — satisfies "ATC does not call ATC").**

## Signature
```typescript
@atc('BK-563')
async acceptReadsAcrossFamilies(rows: Array<{ family: string, id: string }>): Promise<Array<{ family: string, response: APIResponse }>>
```

## Rows
| Family | Endpoint |
|---|---|
| User Stories | `GET /user-stories/{id}` |
| Acceptance Criteria | `GET /acceptance-criteria/{id}` |
| Environments | `GET /projects/{project_id}/environments` |
| Milestones | `GET /projects/{project_id}/milestones` |
| Imports | `GET /imports/{id}` |

## Precondition (test-level, chained after BK-561 in the same test)
- The 5 `rows` returned by `acceptWritesAcrossFamilies` in this same test
- `tokens.mintPatWithScopes({ scopes: ['atc:read'], workspace_id })` (a SEPARATE
  read-scoped PAT from BK-561's write PAT)
- `sweep.setAuthToken(readPat.token)`

## Action
Read each of the 5 rows created by BK-561, using the `atc:read` PAT.

## Fixed assertions (inside ATC, per row)
- `response.status() === 200` on every row

## Test-level assertions
None beyond the per-row fixed assertions.

## Source TC
`test-cases/BK-563-tc13-accept-reads-atc-read.md`
