# ATC BK-567 (TC6) — rejectUnauthenticatedModuleCreation

**Component**: `ModulesApi` · **Fixture**: `{ api }` · **File**: `tests/integration/modules/enforceModuleCapabilityScope.test.ts`

## Signature
```typescript
@atc('BK-567')
async rejectUnauthenticatedModuleCreation(projectId: string, payload: ModulePayload): Promise<[APIResponse, ErrorEnvelope, ModulePayload]>
```

## Precondition (test-level)
- No prior auth call needed — `modules.clearAuthToken()` explicitly, no cookie session
  either (fresh `{ api }` fixture instance, never authenticated)

## Action
`POST /api/v1/projects/{project_id}/modules` with the `Authorization` header omitted entirely.

## Fixed assertions (inside ATC)
- `response.status() === 401`
- `body.error.message === 'Authentication required.'` — distinct failure surface from
  the capability `403` in TC2/TC5 (absent credential ≠ under-scoped credential)

## Test-level assertions
None beyond the ATC's own.

## Source TC
`test-cases/BK-567-tc6-unauthenticated-401.md`
