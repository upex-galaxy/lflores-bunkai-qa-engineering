# ATC BK-568 (TC15) — completeImportLifecycleDualScope

**Component**: `AuthoringSweepApi` · **Fixture**: `{ api }` · **File**: `tests/integration/authoring/completeImportLifecycleDualScope.test.ts`

Embedded create→poll ATC (mirrors BK-497's `BK-545` pattern). Positive control for
BK-559/BK-566's Imports-row 403s.

## Signature
```typescript
@atc('BK-568')
async completeImportLifecycleDualScope(projectId: string): Promise<[APIResponse, APIResponse]>
```

## Precondition (test-level)
- `authenticateSuccessfully()`
- `tokens.mintPatWithScopes({ scopes: ['atc:write', 'atc:read'], workspace_id })`
- `sweep.setAuthToken(pat.token)`

## Action
1. `POST /api/v1/imports` (queues the import job) — ACTION 1
2. Poll `GET /api/v1/imports/{id}` (id from ACTION 1) until the job completes — ACTION 2.
   Use `expect.poll()` or a bounded condition-based retry — NEVER `waitForTimeout`
   (rule #10).

## Fixed assertions (inside ATC)
- ACTION 1: `response.status() === 202`, job id present in body
- ACTION 2 (final poll): `response.status() === 200`

## Test-level assertions
None beyond the ATC's own — proves a client needs BOTH `atc:write` and `atc:read` to
complete the Imports workflow, confirming BK-559/BK-566's Imports-row 403s are
expected, not a defect.

## Source TC
`test-cases/BK-568-tc15-full-import-lifecycle-dual-scope.md`
