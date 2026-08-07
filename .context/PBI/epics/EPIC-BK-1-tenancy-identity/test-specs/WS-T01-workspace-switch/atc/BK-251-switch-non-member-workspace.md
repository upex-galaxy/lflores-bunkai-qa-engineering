# ATC Spec: BK-251 — switchToNonMemberWorkspace

> Ticket: BK-6
> Component: WorkspaceApi (tests/components/api/WorkspaceApi.ts)
> Type: API — Mutation (negative path)
> Parent Story: BK-6

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| switchToNonMemberWorkspace | Verify a user CANNOT switch their active workspace to one where they hold no membership row | Authenticated; target workspace exists but has zero `workspace_members` rows for the caller | Response 403 `{error:{code:'forbidden',message}}`; `GET /me` still reflects the PRE-switch `active_workspace_id` (session did not rotate) |

## 2. ATC Contract

```typescript
/**
 * ATC: POST /me/active-workspace with a target the caller has no membership row for.
 * Fixed assertions:
 *  - 403 Forbidden
 *  - body.error.code === 'forbidden'
 */
@atc('BK-251')
async switchToNonMemberWorkspace(
  payload: ActiveWorkspaceBody,
): Promise<[APIResponse, ActiveWorkspaceError, ActiveWorkspaceBody]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `POST /me/active-workspace` |
| Request body | `{ workspace_id: string (uuid) }` — a real workspace, zero membership rows for the caller |
| Error response | 403 `ErrorEnvelope` — `{ error: { code: 'forbidden', message, details? } }` |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 403`
- `body.error.code === 'forbidden'`

### Test-level (in test file)
- Follow-up `GET /me` shows `active_workspace_id` UNCHANGED from before the attempted
  switch — proves the session did not partially rotate on a rejected request.

## 5. Code Template

```typescript
@atc('BK-251')
async switchToNonMemberWorkspace(
  payload: ActiveWorkspaceBody,
): Promise<[APIResponse, ActiveWorkspaceError, ActiveWorkspaceBody]> {
  const [response, body, sentPayload] = await this.apiPOST<ActiveWorkspaceError, ActiveWorkspaceBody>(
    '/me/active-workspace',
    payload,
  );

  expect(response.status()).toBe(403);
  expect(body.error.code).toBe('forbidden');

  return [response, body, sentPayload];
}
```

## 6. Technique-derivation check

Same EP derivation as documented in `atc/BK-250-switch-active-workspace.md` §6 — this ATC
is the "no row" partition (distinct from BK-252's "suspended" partition, even though both
return 403; the business reason and DB state differ).

## 7. Data Context — Discover, documented fixed reference

**Architecture gap found while planning this ATC**: the automation-plan's original data
strategy for BK-251 ("Discover via DB SELECT") assumed the test itself could query the DB
at runtime. It cannot — this KATA framework has no DB client wired into `tests/` (only the
AI-facing `staging-dbhub` MCP, used at plan/authoring time, not by compiled test code).
True runtime Discover (the test dynamically finding a non-member workspace each run) is
also not possible via API — no endpoint lists workspaces the caller is NOT a member of
(correctly so; that would be a cross-tenant data leak). The only zero-hardcode alternative
is a full Generate chain (signup → read email OTP via Resend → confirm → create workspace
as the new user) — rejected as disproportionate (3 new ATCs + email-round-trip flakiness)
for a single negative-path 403 check. Decision confirmed with user 2026-08-07.

**Resolution — fixed reference constant, validated + documented**:
- Workspace: `bunkai1-qa` — id `047c106e-5334-4a80-8b66-d99ef4c474b4`
- Validated via direct query against staging `workspace_members` on 2026-08-07: caller
  (`bunkai-staging-userlf@ambuusteln.resend.app`, user id `2742da39-e0ff-4f0c-a0a1-88dae804e14f`)
  has zero rows for this workspace.
- Reserved fixture — same convention as `BK5 Test Workspace` (reserved for BK-252). Do
  NOT add the BK-6 test user as a member of `bunkai1-qa`; do NOT delete this workspace.
  Doing so breaks this TC with a false result, not a real regression.
- Constant lives in the test file (`WORKSPACE_NOT_MEMBER_ID`), not `DataFactory` — it is a
  fixed environment reference, not generated data.

## 8. Dependencies

- Precondition: `AuthApi.authenticateSuccessfully()` (existing) for login;
  `AuthApi.getCurrentUser()` (existing helper) for the pre/post `active_workspace_id`
  comparison.
- Required Components: `WorkspaceApi` — existing (extends with this ATC).

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `switchToNonMemberWorkspace`
- [x] Max 2 positional params — 1 (object param `payload`)
- [x] Correct return type — tuple `[APIResponse, TBody, TPayload]` for a POST
- [x] Fixed vs test-level assertions split (§4 above)
- [x] Not duplicating an existing ATC — checked `kata-manifest.json`, only BK-250 exists
