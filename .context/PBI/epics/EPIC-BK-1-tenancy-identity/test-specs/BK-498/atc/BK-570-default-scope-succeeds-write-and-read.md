# ATC BK-570 (TC8) — defaultScopeSucceedsOnWriteAndRead

**Component**: `ModulesApi` · **Fixture**: `{ api }` · **File**: `tests/integration/modules/enforceModuleCapabilityScope.test.ts`

## Signature
```typescript
@atc('BK-570')
async defaultScopeSucceedsOnWriteAndRead(projectId: string, moduleId: string, payload: ModulePayload): Promise<[APIResponse, APIResponse]>
```

Embedded 2-action ATC (mirrors BK-497's `BK-545` pattern) — non-regression control, not
2 independent facts (single Jira Test issue).

## Precondition (test-level)
- `modules.setAuthToken(process.env.API_TOKEN_OWNER_STAGING)` — default-scope token
  from `.auth/tokens.env` directly, no mint call (this IS the "existing role token"
  the TC specifies)

## Action
1. `POST /api/v1/projects/{project_id}/modules` (ACTION 1)
2. `GET /api/v1/modules/{module_id}/user-stories` (ACTION 2)

## Fixed assertions (inside ATC)
- ACTION 1: `response.status() === 201`
- ACTION 2: `response.status() === 200`

## Test-level assertions
None beyond the ATC's own — confirms default-scope tokens (the common case) lose
nothing from this Story's enforcement change.

## Source TC
`test-cases/BK-570-tc8-default-scope-non-regression.md`
