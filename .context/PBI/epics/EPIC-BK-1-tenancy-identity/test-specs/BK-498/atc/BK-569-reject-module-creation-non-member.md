# ATC BK-569 (TC7) — rejectModuleCreationNonMember

**Component**: `ModulesApi` · **Fixture**: `{ api }` · **File**: `tests/integration/modules/enforceModuleCapabilityScope.test.ts`

## Signature
```typescript
@atc('BK-569')
async rejectModuleCreationNonMember(projectId: string, payload: ModulePayload): Promise<[APIResponse, ErrorEnvelope, ModulePayload]>
```

## Precondition (test-level)
- `auth.authenticateSuccessfully(config.testNonMember)` — signs in as
  `STAGING_NON_MEMBER_EMAIL`, a real account deliberately never invited to
  BK264 QA Sandbox (or any other workspace). Sign-in auto-mints an unbound
  default-scoped PAT (`atc:read` + `atc:write` + `run:execute`, `workspace_id:
  null`) and sets it as the Bearer token.

**Resolution of the original plan (automation-plan.md §7 Risk 1)**: the
original precondition tried `mintPatWithScopes({ workspace_id:
WORKSPACE_NOT_MEMBER_ID })`, which 403s at MINT time — `assertTokenIssuanceAuthorized`
(`lib/api/pat.ts`) requires active membership for ANY `workspace_id` binding,
admin scope or not. Confirmed live on staging 2026-08-23: an UNBOUND `atc:write`
PAT mints successfully for any authenticated user regardless of membership
(`!args.workspaceId` short-circuits the membership check entirely), and the
`/modules` route (`app/api/v1/projects/[id]/modules/route.ts`) only gates on
the capability at the handler (`requires: ['atc:write']`) — the actual
membership check is RLS on the `modules` INSERT, which a non-member fails
with Postgrest `42501`, mapped to `403 { code: 'forbidden', details.reason:
'not_a_member' }`. Live-verified against `BK264_DEFECT_TRIAGE_PROJECT_ID` with
the new `bk569-nonmember@ambuusteln.resend.app` identity: reproduces
byte-for-byte.

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
