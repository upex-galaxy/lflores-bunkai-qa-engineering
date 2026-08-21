# ATC BK-560 (TC2) — rejectModuleCreationReadOnlyPat

**Component**: `ModulesApi` · **Fixture**: `{ api }` · **File**: `tests/integration/modules/enforceModuleCapabilityScope.test.ts`

## Signature
```typescript
@atc('BK-560')
async rejectModuleCreationReadOnlyPat(projectId: string, payload: ModulePayload): Promise<[APIResponse, ErrorEnvelope, ModulePayload]>
```

## Precondition (test-level)
- `authenticateSuccessfully()`
- `tokens.mintPatWithScopes({ scopes: ['atc:read'], workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID })`
- `modules.setAuthToken(pat.token)`

## Action
`POST /api/v1/projects/{project_id}/modules` using the `atc:read` PAT.

## Fixed assertions (inside ATC)
- `response.status() === 403`
- `body.error.message` indicates missing `atc:write` capability

## Test-level assertions
Zero-side-effect check: a follow-up `GET` (e.g. `getModuleUserStories` or a module list,
whichever is cheapest) confirms no row was inserted for this attempt — DB cross-check
substitute per the no-runtime-DB-client constraint (BK-497/WS-T01 precedent).

## Source TC
`test-cases/BK-560-tc2-reject-module-read-pat.md`
