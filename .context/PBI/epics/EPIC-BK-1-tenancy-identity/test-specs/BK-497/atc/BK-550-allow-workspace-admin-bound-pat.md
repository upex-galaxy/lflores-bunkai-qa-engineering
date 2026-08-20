# ATC Spec: BK-550 — allowWorkspaceAdminActionWithBoundPat

> Ticket: BK-497
> Component: WorkspaceApi (tests/components/api/WorkspaceApi.ts) — EXTEND
> Type: API — Mutation (positive control)
> Parent Story: BK-497

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| allowWorkspaceAdminActionWithBoundPat | Verify a PAT correctly scoped `workspace:admin` AND bound to the target workspace CAN perform a workspace-admin action | PAT scoped `workspace:admin`, bound to the target workspace | Response 200, workspace reflects the update |

## 2. ATC Contract

```typescript
/**
 * ATC: PATCH /api/v1/workspaces/{workspaceId} using a workspace:admin-scoped, bound PAT.
 * Fixed assertions:
 *  - 200 OK
 *  - body.workspace.name === payload sent
 */
@atc('BK-550')
async allowWorkspaceAdminActionWithBoundPat(
  args: { workspaceId: string, body: WorkspacePatchBody },
): Promise<[APIResponse, WorkspaceResponse, WorkspacePatchBody]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `PATCH /api/v1/workspaces/{id}` |
| Path param | `workspaceId` — caller's own workspace, same one the PAT is bound to |
| Request body | `WorkspacePatchBody` — `{ name }`; no-op-equivalent update (set to its own current value) to avoid polluting the fixture workspace's display name |
| Response | 200 `WorkspaceResponse` — `{ workspace: Workspace }` |
| Auth | `this.authToken` ambient — set to the `workspace:admin`-scoped, bound PAT by the test precondition |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 200`
- `body.workspace.name === payload.name`

### Test-level (in test file)
- None required — single-call positive control, counterweight to BK-544/548/551.

## 5. Code Template

```typescript
@atc('BK-550')
async allowWorkspaceAdminActionWithBoundPat(
  args: { workspaceId: string, body: WorkspacePatchBody },
): Promise<[APIResponse, WorkspaceResponse, WorkspacePatchBody]> {
  const [response, respBody, sentPayload] = await this.apiPATCH<WorkspaceResponse, WorkspacePatchBody>(
    `/api/v1/workspaces/${args.workspaceId}`,
    args.body,
  );

  expect(response.status()).toBe(200);
  expect(respBody.workspace.name).toBe(args.body.name);

  return [response, respBody, sentPayload];
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|----|-----------------|----------------|
| AC-06 non-regression (workspace-admin allow path) | EP (always) | 1 — "correctly scoped + bound" positive partition, sibling of BK-551's "wrong workspace" negative partition |

## 7. Dependencies

- Precondition: `AuthApi.authenticateSuccessfully()`; `AuthApi.getCurrentUser()`;
  `TokensApi.mintPatWithScopes({ scopes: ['workspace:admin'], workspace_id })` (test-level).
- Required Components: `WorkspaceApi` — extended. `TokensApi` — new, sibling.

## 8. Data Context

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Caller's own workspace | Discover | `auth.getCurrentUser()` | Test body | None |
| `workspace:admin`-scoped, bound PAT | Generate | `tokens.mintPatWithScopes({ scopes: ['workspace:admin'], workspace_id })` | `beforeEach` | None |

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `allowWorkspaceAdminActionWithBoundPat`
- [x] Max 2 positional params — 1 (object param `args`)
- [x] Correct return type — tuple `[APIResponse, TBody, TPayload]` for a PATCH
- [x] Fixed vs test-level assertions split (§4)
- [x] Not duplicating an existing ATC
