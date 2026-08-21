# ATC BK-557 (TC9) — createModuleViaSessionRegardlessOfPatScope

**Component**: `ModulesApi` · **Fixture**: `{ api }` · **File**: `tests/integration/modules/enforceModuleCapabilityScope.test.ts`

## Signature
```typescript
@atc('BK-557')
async createModuleViaSessionRegardlessOfPatScope(projectId: string, payload: ModulePayload): Promise<[APIResponse, ModuleResponse, ModulePayload]>
```

Critical priority — the most common real-world request shape (browser session, not PAT).

## Precondition (test-level)
- `authenticateSuccessfully()` (establishes session cookie in the shared `APIRequestContext`)
- `modules.clearAuthToken()` — forces cookie-only, no Bearer PAT involved at all

## Action
`POST /api/v1/projects/{project_id}/modules` using only the session cookie.

## Fixed assertions (inside ATC)
- `response.status() === 201` — browser sessions always carry the full capability set
  and are never narrowed like a PAT can be

## Test-level assertions
None beyond the ATC's own.

## Source TC
`test-cases/BK-557-tc9-browser-session-bypasses-pat-scope.md`
