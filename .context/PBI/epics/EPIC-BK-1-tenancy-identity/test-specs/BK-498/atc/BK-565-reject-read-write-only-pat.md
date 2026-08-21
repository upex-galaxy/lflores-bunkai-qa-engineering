# ATC BK-565 (TC5) — rejectReadWithWriteOnlyPat

**Component**: `ModulesApi` · **Fixture**: `{ api }` · **File**: `tests/integration/modules/enforceModuleCapabilityScope.test.ts`

## Signature
```typescript
@atc('BK-565')
async rejectReadWithWriteOnlyPat(moduleId: string): Promise<[APIResponse, ErrorEnvelope]>
```

## Precondition (test-level)
- `authenticateSuccessfully()`
- `tokens.mintPatWithScopes({ scopes: ['atc:write'], workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID })`
- `modules.setAuthToken(pat.token)`

## Action
`GET /api/v1/modules/{module_id}/user-stories` using the `atc:write`-only PAT.

## Fixed assertions (inside ATC)
- `response.status() === 403`
- `body.error.message` indicates missing `atc:read` capability — read-mirror of TC2,
  proves the read gate is `atc:read` specifically, not "any authenticated capability"

## Test-level assertions
None beyond the ATC's own.

## Source TC
`test-cases/BK-565-tc5-reject-read-write-pat.md`
