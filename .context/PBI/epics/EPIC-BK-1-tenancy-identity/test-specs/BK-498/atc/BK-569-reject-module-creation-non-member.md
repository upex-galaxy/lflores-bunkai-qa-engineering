# ATC BK-569 (TC7) — rejectModuleCreationNonMember

**Component**: `ModulesApi` · **Fixture**: `{ api }` · **File**: `tests/integration/modules/enforceModuleCapabilityScope.test.ts`

## Signature
```typescript
@atc('BK-569')
async rejectModuleCreationNonMember(projectId: string, payload: ModulePayload): Promise<[APIResponse, ErrorEnvelope, ModulePayload]>
```

## Precondition (test-level)
- `authenticateSuccessfully()`
- `tokens.mintPatWithScopes({ scopes: ['atc:write'], workspace_id: WORKSPACE_NOT_MEMBER_ID })`
  — **binding semantics NOT yet confirmed live for this family** (automation-plan.md §7
  Risk 1); Code phase must verify this reproduces `not_a_member` against
  `BK264_DEFECT_TRIAGE_PROJECT_ID`'s modules endpoint before finalizing
- `modules.setAuthToken(pat.token)`

## Action
`POST /api/v1/projects/{project_id}/modules` using the correctly-scoped-but-non-member PAT.

## Fixed assertions (inside ATC)
- `response.status() === 403`
- rejection reason is `not_a_member` (or equivalent field/message) — DISTINCT from
  TC2's capability-403, proves the gate does not conflate the two failure classes

## Test-level assertions
Zero-side-effect check (same pattern as BK-560).

## Source TC
`test-cases/BK-569-tc7-reject-not-a-member.md`
