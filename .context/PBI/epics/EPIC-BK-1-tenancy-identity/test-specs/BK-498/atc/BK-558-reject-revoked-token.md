# ATC BK-558 (TC10) — rejectRevokedTokenWithInvalidMessage

**Component**: `ModulesApi` · **Fixture**: `{ api }` · **File**: `tests/integration/modules/enforceModuleCapabilityScope.test.ts`

## Signature
```typescript
@atc('BK-558')
async rejectRevokedTokenWithInvalidMessage(projectId: string, payload: ModulePayload): Promise<[APIResponse, ErrorEnvelope, ModulePayload]>
```

## Precondition (test-level)
- `authenticateSuccessfully()`
- `const pat = await tokens.mintPatWithScopes({ scopes: ['atc:write'], workspace_id })`
- `await tokens.revokeToken(pat.id)` (session-authenticated, immediately after mint)
- `modules.setAuthToken(pat.token)` — the raw token string, now revoked server-side

## Action
`POST /api/v1/projects/{project_id}/modules` using the revoked token as Bearer.

## Fixed assertions (inside ATC)
- `response.status() === 401` (NOT 403)
- `body.error.message === 'Invalid token.'` — distinct failure surface from the
  valid-but-under-scoped `403` in TC2/TC5; proves token-revocation is checked before
  the capability gate

## Test-level assertions
None beyond the ATC's own.

## Source TC
`test-cases/BK-558-tc10-revoked-token-401-vs-403.md`
