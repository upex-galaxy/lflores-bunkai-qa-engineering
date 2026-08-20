# ATC Spec: BK-551 — rejectCrossWorkspaceAdminPat

> Ticket: BK-497
> Component: WorkspaceApi (tests/components/api/WorkspaceApi.ts) — EXTEND
> Type: API — Negative (workspace-binding rejection)
> Parent Story: BK-497

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| rejectCrossWorkspaceAdminPat | Verify a PAT scoped `workspace:admin` but bound to workspace A CANNOT act on workspace B | PAT scoped `workspace:admin`, bound to workspace A; workspace B exists | Response 403, message: "This token is scoped to a different workspace." |

## 2. ATC Contract

```typescript
/**
 * ATC: PATCH /api/v1/workspaces/{workspaceBId} using a PAT bound to a DIFFERENT workspace.
 * Fixed assertions:
 *  - 403 Forbidden
 *  - body.error.message === 'This token is scoped to a different workspace.'
 */
@atc('BK-551')
async rejectCrossWorkspaceAdminPat(
  args: { workspaceId: string, body: WorkspacePatchBody },
): Promise<[APIResponse, ErrorEnvelope, WorkspacePatchBody]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `PATCH /api/v1/workspaces/{id}` |
| Path param | `args.workspaceId` — workspace B (`WORKSPACE_NOT_MEMBER_ID`), NOT the PAT's bound workspace A |
| Request body | `WorkspacePatchBody` — `{ name }`, content irrelevant (rejected before mutation) |
| Error response | 403 `ErrorEnvelope` — verbatim `message` |
| Auth | `this.authToken` ambient — set to the `workspace:admin`-scoped PAT BOUND TO WORKSPACE A |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 403`
- `body.error.message === 'This token is scoped to a different workspace.'`

### Test-level (in test file)
- None required — single-call negative check, sibling of BK-550.

## 5. Code Template

```typescript
@atc('BK-551')
async rejectCrossWorkspaceAdminPat(
  args: { workspaceId: string, body: WorkspacePatchBody },
): Promise<[APIResponse, ErrorEnvelope, WorkspacePatchBody]> {
  const [response, body, sentPayload] = await this.apiPATCH<ErrorEnvelope, WorkspacePatchBody>(
    `/api/v1/workspaces/${args.workspaceId}`,
    args.body,
  );

  expect(response.status()).toBe(403);
  expect(body.error.message).toBe('This token is scoped to a different workspace.');

  return [response, body, sentPayload];
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|----|-----------------|----------------|
| AC-06 non-regression (cross-workspace-binding guard) | EP (always) | 1 — "correctly scoped, wrong workspace" partition, distinct from BK-550's "correctly scoped, correct workspace" partition (different outcome, separate ATC per EP rule) |

**Refinement note (carried from the TC)**: substitutes for the ATP's literal TC-03/AC-06
unresolvable-workspace scenario (blocked by design — `assertTokenIssuanceAuthorized`,
BK-135/ADR-0005; QA DB role is read-only, cannot simulate the legacy unbound state; no
non-owner admin seed identity with 2+ workspace memberships exists in `.env`). This ATC
exercises the sibling branch of the same guard function (`assertWorkspaceContext`) and is
fully automatable. AC-06's literal scenario stays Deferred, covered by the dev's own
`workspace-context` unit suite.

## 7. Dependencies

- Precondition: `AuthApi.authenticateSuccessfully()`; `AuthApi.getCurrentUser()` (workspace A);
  `TokensApi.mintPatWithScopes({ scopes: ['workspace:admin'], workspace_id: workspaceAId })`
  (test-level).
- Required Components: `WorkspaceApi` — extended. `TokensApi` — new, sibling.
- Reuses the `WORKSPACE_NOT_MEMBER_ID` constant already established by WS-T01/BK-251
  (`switchActiveWorkspace.test.ts`) — promoted to `tests/data/constants.ts` per
  automation-plan.md §3 Step 3.

## 8. Data Context

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Workspace A (caller's own, PAT-bound) | Discover | `auth.getCurrentUser()` | Test body | None |
| Workspace B (not the PAT's binding) | Discover (design-time constant) | `WORKSPACE_NOT_MEMBER_ID` (`tests/data/constants.ts`, reused from WS-T01) | Constant | None |
| `workspace:admin`-scoped PAT bound to workspace A | Generate | `tokens.mintPatWithScopes({ scopes: ['workspace:admin'], workspace_id: workspaceAId })` | `beforeEach` | None |

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `rejectCrossWorkspaceAdminPat`
- [x] Max 2 positional params — 1 (object param `args`)
- [x] Correct return type — tuple `[APIResponse, TBody, TPayload]` for a PATCH
- [x] Fixed vs test-level assertions split (§4)
- [x] Not duplicating an existing ATC
