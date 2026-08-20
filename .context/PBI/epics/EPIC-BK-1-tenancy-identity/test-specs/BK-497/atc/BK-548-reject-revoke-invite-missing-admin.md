# ATC Spec: BK-548 — rejectRevokeInviteWithoutAdminScope

> Ticket: BK-497
> Component: WorkspaceApi (tests/components/api/WorkspaceApi.ts) — EXTEND
> Type: API — Negative (scope-based rejection)
> Parent Story: BK-497

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| rejectRevokeInviteWithoutAdminScope | Verify a PAT scoped `atc:write` + `run:execute` (no `workspace:admin`) cannot revoke a pending invite | PAT scoped `atc:write`+`run:execute`; a pre-existing pending invite exists in a workspace the PAT is bound to | Response 403, message indicates missing `workspace:admin`, invite's `revoked_at` unchanged |

## 2. ATC Contract

```typescript
/**
 * ATC: DELETE /api/v1/workspaces/{workspaceId}/invites/{inviteId} using a PAT without
 * workspace:admin.
 * Fixed assertions:
 *  - 403 Forbidden
 *  - body.error.code === 'forbidden'
 */
@atc('BK-548')
async rejectRevokeInviteWithoutAdminScope(
  args: { workspaceId: string, inviteId: string },
): Promise<[APIResponse, ErrorEnvelope]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `DELETE /api/v1/workspaces/{id}/invites/{inviteId}` |
| Path params | `workspaceId` (caller's own), `inviteId` (pre-existing pending invite, Generated) |
| Error response | 403 `ErrorEnvelope` — `{ error: { code: 'forbidden', message } }` |
| Auth | `this.authToken` ambient — set to the `atc:write`+`run:execute` PAT by the test precondition |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 403`
- `body.error.code === 'forbidden'`

### Test-level (in test file)
- `workspace.getWorkspaceInvites(workspaceId)` (owner session, restored) shows the invite's
  `revoked_at === null` — test-level, different credential than the one under test.

## 5. Code Template

```typescript
@atc('BK-548')
async rejectRevokeInviteWithoutAdminScope(
  args: { workspaceId: string, inviteId: string },
): Promise<[APIResponse, ErrorEnvelope]> {
  const [response, body] = await this.apiDELETE<ErrorEnvelope>(
    `/api/v1/workspaces/${args.workspaceId}/invites/${args.inviteId}`,
  );

  expect(response.status()).toBe(403);
  expect(body.error.code).toBe('forbidden');

  return [response, body];
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|----|-----------------|----------------|
| AC-05 non-regression (invite-revocation scope guard) | EP (always) | 1 — `atc:write`+`run:execute` (missing `workspace:admin`) is the "insufficient scope" partition for the revoke action, distinct from BK-544's create-action partition (different endpoint, same guard family, EP does not merge across endpoints) |

## 7. Dependencies

- Precondition: `AuthApi.authenticateSuccessfully()`; `AuthApi.getCurrentUser()`;
  `WorkspaceApi.createWorkspaceInvite()` (new helper, owner session) for the pending invite;
  `TokensApi.mintPatWithScopes({ scopes: ['atc:write','run:execute'], workspace_id })` (test-level).
- Required Components: `WorkspaceApi` — extended. `TokensApi` — new, sibling.

## 8. Data Context

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Caller's own workspace | Discover | `auth.getCurrentUser()` | Test body | None |
| Pending invite | Generate | `workspace.createWorkspaceInvite({ workspaceId, body: { email: faker } })` (OWNER session, before the PAT swap) | `beforeEach` | Optional: `DELETE` via owner session in `afterEach` |
| `atc:write`+`run:execute` PAT bound to that workspace | Generate | `tokens.mintPatWithScopes({ scopes: ['atc:write','run:execute'], workspace_id })` | `beforeEach`, AFTER the invite is created (owner session must create it first) | None |

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `rejectRevokeInviteWithoutAdminScope`
- [x] Max 2 positional params — 1 (object param `args`)
- [x] Correct return type — tuple `[APIResponse, TBody]` for a DELETE
- [x] Fixed vs test-level assertions split (§4)
- [x] Not duplicating an existing ATC
