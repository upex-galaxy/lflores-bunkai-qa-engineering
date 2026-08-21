# ATC BK-566 (TC14) — rejectReadsAcrossFamilies

**Component**: `AuthoringSweepApi` · **Fixture**: `{ api }` · **File**: `tests/integration/authoring/enforceAuthoringWriteReadSweep.test.ts`

Parametrized artifact — 5 rows. Consumes BK-561's row refs, same as BK-563.

## Signature
```typescript
@atc('BK-566')
async rejectReadsAcrossFamilies(rows: Array<{ family: string, id: string }>): Promise<Array<{ family: string, response: APIResponse }>>
```

## Rows
Same 5 read endpoints as BK-563.

## Precondition (test-level, chained after BK-561 in the same test — reuses BK-561's
own write PAT, does NOT mint a new one)
- The 5 `rows` returned by `acceptWritesAcrossFamilies` in this same test
- `sweep.setAuthToken(writePat.token)` — the write-only PAT from BK-561's precondition

## Action
Read each of the 5 rows, using the `atc:write`-only PAT (no `atc:read`).

## Fixed assertions (inside ATC, per row)
- `response.status() === 403` on every row, INCLUDING the Imports row
- The Imports row's 403 is the ratified expected behavior (2026-08-19 AI PO decision),
  NOT a regression — see BK-568 for the positive control

## Test-level assertions
None beyond the per-row fixed assertions.

## Source TC
`test-cases/BK-566-tc14-reject-reads-atc-write-only.md`
