# ATC Spec: BK-544 — rejectInviteCreationWithReadOnlyPat

> Ticket: BK-497
> Component: WorkspaceApi (tests/components/api/WorkspaceApi.ts) — EXTEND
> Type: API — Negative (scope-based rejection)
> Parent Story: BK-497

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| rejectInviteCreationWithReadOnlyPat | Verify a PAT scoped only `atc:read` cannot create a workspace invite (needs `workspace:admin`) | Caller holds a PAT scoped exactly `atc:read`, minted via `POST /api/v1/tokens` (session-authenticated) | Response 403, message indicates missing `workspace:admin`, no invite row created for the target email |

## 2. ATC Contract

```typescript
/**
 * ATC: POST /api/v1/workspaces/{workspaceId}/invites using an atc:read-only PAT.
 * Fixed assertions:
 *  - 403 Forbidden
 *  - body.error.code === 'forbidden'
 */
@atc('BK-544')
async rejectInviteCreationWithReadOnlyPat(
  args: { workspaceId: string, invite: WorkspaceInviteCreateBody },
): Promise<[APIResponse, ErrorEnvelope, WorkspaceInviteCreateBody]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `POST /api/v1/workspaces/{id}/invites` |
| Path param | `workspaceId` — caller's own workspace (Discover via `auth.getCurrentUser()`) |
| Request body | `WorkspaceInviteCreateBody` — `{ email, role? }`, faker-generated email |
| Error response | 403 `ErrorEnvelope` — `{ error: { code: 'forbidden', message } }` |
| Auth | `this.authToken` ambient — set to the `atc:read`-only PAT by the test precondition |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 403`
- `body.error.code === 'forbidden'`

### Test-level (in test file)
- `workspace.getWorkspaceInvites(workspaceId)` (owner session, RESTORED after this ATC) shows
  no invite for the target email — test-level because it requires switching back to a
  DIFFERENT (properly-scoped) credential than the one under test, per Rule 6.

## 5. Code Template

```typescript
@atc('BK-544')
async rejectInviteCreationWithReadOnlyPat(
  args: { workspaceId: string, invite: WorkspaceInviteCreateBody },
): Promise<[APIResponse, ErrorEnvelope, WorkspaceInviteCreateBody]> {
  const [response, body, sentPayload] = await this.apiPOST<ErrorEnvelope, WorkspaceInviteCreateBody>(
    `/api/v1/workspaces/${args.workspaceId}/invites`,
    args.invite,
  );

  expect(response.status()).toBe(403);
  expect(body.error.code).toBe('forbidden');

  return [response, body, sentPayload];
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|----|-----------------|----------------|
| AC-04 non-regression (invite-creation scope guard) | EP (always) | 1 — `atc:read`-only is the "insufficient scope" partition; the "correctly scoped" partition is BK-550's sibling flow (different resource, same guard family) |

## 7. Dependencies

- Precondition: `AuthApi.authenticateSuccessfully()`; `AuthApi.getCurrentUser()` (workspace
  discovery); `TokensApi.mintPatWithScopes({ scopes: ['atc:read'], workspace_id })` (cross-component
  precondition, called at TEST level, not from inside this ATC — see automation-plan.md §2
  "Component Strategy" row on preconditions).
- Required Components: `WorkspaceApi` — existing, extended. `TokensApi` — new, sibling component
  (no direct code dependency between the two components; the test file wires the minted token
  onto `workspace.authToken`).

## 8. Data Context

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Caller's own workspace | Discover | `auth.getCurrentUser()` → `active_workspace_id` | Test body | None |
| `atc:read`-only PAT bound to that workspace | Generate | `tokens.mintPatWithScopes({ scopes: ['atc:read'], workspace_id })` | `beforeEach` | None (see automation-plan.md §4) |

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `rejectInviteCreationWithReadOnlyPat`
- [x] Max 2 positional params — 1 (object param `args`)
- [x] Correct return type — tuple `[APIResponse, TBody, TPayload]` for a POST
- [x] Fixed vs test-level assertions split (§4)
- [x] Not duplicating an existing ATC — checked `kata-manifest.json`, `WorkspaceApi` currently
      has only BK-250/251/252 (all `/me/active-workspace`, not `/invites`)
