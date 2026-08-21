# ATC BK-561 (TC12) — acceptWritesAcrossFamilies

**Component**: `AuthoringSweepApi` · **Fixture**: `{ api }` · **File**: `tests/integration/authoring/enforceAuthoringWriteReadSweep.test.ts`

Parametrized artifact — 5 rows. **Returns the created-row refs; TC13/TC14 consume them.**

## Signature
```typescript
@atc('BK-561')
async acceptWritesAcrossFamilies(moduleId: string, projectId: string): Promise<Array<{ family: string, id: string, response: APIResponse }>>
```

## Rows
Same 5 endpoints as BK-559 (write leg), `atc:write` PAT this time.

## Precondition (test-level)
- `authenticateSuccessfully()`
- `tokens.mintPatWithScopes({ scopes: ['atc:write'], workspace_id })`
- `sweep.setAuthToken(pat.token)`

## Action
Perform one write per family, using the `atc:write` PAT.

## Fixed assertions (inside ATC, per row)
- `response.status()` is 2xx on every row
- a DB side-effect id exists in the response body for every row (captured and returned)

## Test-level assertions
None — the returned row refs ARE the test-level artifact consumed by BK-563/BK-566 in
the same test (see automation-plan.md §5, Scenario 12-14).

## Source TC
`test-cases/BK-561-tc12-accept-writes-atc-write-only.md`
