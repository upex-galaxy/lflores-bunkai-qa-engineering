# ATC BK-556 (TC1) — createModuleSuccessfully

**Component**: `ModulesApi` · **Fixture**: `{ api }` · **File**: `tests/integration/modules/enforceModuleCapabilityScope.test.ts`

## Signature
```typescript
@atc('BK-556')
async createModuleSuccessfully(projectId: string, payload: ModulePayload): Promise<[APIResponse, ModuleResponse, ModulePayload]>
```

## Precondition (test-level, before ATC call)
- `authenticateSuccessfully()`
- `tokens.mintPatWithScopes({ scopes: ['atc:write'], workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID })`
- `modules.setAuthToken(pat.token)`

## Action
`POST /api/v1/projects/{project_id}/modules` with a valid module payload, using the `atc:write` bound PAT.

## Fixed assertions (inside ATC)
- `response.status() === 201`
- `body.id` defined

## Test-level assertions
None beyond the ATC's own — positive control, single call.

## Source TC
`test-cases/BK-556-tc1-create-module-write-pat.md`
