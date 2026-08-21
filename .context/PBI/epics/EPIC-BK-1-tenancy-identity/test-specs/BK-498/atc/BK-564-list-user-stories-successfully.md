# ATC BK-564 (TC4) — listUserStoriesSuccessfully

**Component**: `ModulesApi` · **Fixture**: `{ api }` · **File**: `tests/integration/modules/enforceModuleCapabilityScope.test.ts`

## Signature
```typescript
@atc('BK-564')
async listUserStoriesSuccessfully(moduleId: string): Promise<[APIResponse, UserStoriesListResponse]>
```

## Precondition (test-level)
- `authenticateSuccessfully()`
- `tokens.mintPatWithScopes({ scopes: ['atc:read'], workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID })`
- `modules.setAuthToken(pat.token)`

## Action
`GET /api/v1/modules/{module_id}/user-stories` using the `atc:read` PAT.

## Fixed assertions (inside ATC)
- `response.status() === 200`
- response body is a User Stories list (array) — proves the gate is capability-based,
  not resource-type-based (AC-08a)

## Test-level assertions
None beyond the ATC's own.

## Source TC
`test-cases/BK-564-tc4-list-user-stories-read-pat.md`
