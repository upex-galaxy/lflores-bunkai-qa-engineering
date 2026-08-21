# ATC BK-562 (TC3) — createModuleWithUnboundPat

**Component**: `ModulesApi` · **Fixture**: `{ api }` · **File**: `tests/integration/modules/enforceModuleCapabilityScope.test.ts`

## Signature
```typescript
@atc('BK-562')
async createModuleWithUnboundPat(projectId: string, payload: ModulePayload): Promise<[APIResponse, ModuleResponse, ModulePayload]>
```

## Precondition (test-level)
- `authenticateSuccessfully()`
- `tokens.mintPatWithScopes({ scopes: ['atc:write'] })` — `workspace_id` omitted (unbound)
- underlying user IS an active member of the target project's workspace (same test user)
- `modules.setAuthToken(pat.token)`

## Action
`POST /api/v1/projects/{project_id}/modules` using the unbound `atc:write` PAT.

## Fixed assertions (inside ATC)
- `response.status() === 201` — capability check does not depend on token-workspace
  binding, only on capability + the user's real membership (AC-07)

## Test-level assertions
None beyond the ATC's own.

## Source TC
`test-cases/BK-562-tc3-create-module-unbound-write-pat.md`
