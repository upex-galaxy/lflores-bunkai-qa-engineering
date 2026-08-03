# ATC Spec: BK-250 — switchToActiveWorkspace

> Ticket: BK-6
> Component: WorkspaceApi (tests/components/api/WorkspaceApi.ts)
> Type: API — Mutation
> Parent Story: BK-6

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| switchToActiveWorkspace | Verify a user can switch their session's active workspace to one where they hold an active membership | Authenticated; active membership in both source and target workspace | Response 200 with `{id,slug,name,role}` matching target; `GET /me` reflects the new `active_workspace_id` |

## 2. ATC Contract

```typescript
/**
 * ATC: POST /me/active-workspace with a target the caller is an active member of.
 * Fixed assertions:
 *  - 200 OK
 *  - body.id === payload.workspace_id
 *  - body.slug, body.name defined
 */
@atc('BK-250')
async switchToActiveWorkspace(
  payload: ActiveWorkspaceBody,
): Promise<[APIResponse, ActiveWorkspaceResponse, ActiveWorkspaceBody]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `POST /me/active-workspace` (relative to `apiUrl`, which already includes `/api/v1`) |
| Request body | `{ workspace_id: string (uuid) }` |
| Success response | `{ id, slug, name, role }` — real schema, see spec.md Refinement Note re: stale Jira doc |
| Error responses | 401 (not signed in) / 403 (not an active member) / 422 (validation) — all `ErrorEnvelope` |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 200`
- `body.id === payload.workspace_id`
- `body.slug` and `body.name` are defined

### Test-level (in test file)
- Follow-up `GET /me` reflects `active_workspace_id === workspace_id` — this is the actual
  business proof the switch took effect session-wide, not just that one endpoint answered
  200. Belongs in the test, not the ATC, because it composes two different endpoints.

## 5. Code Template

```typescript
@atc('BK-250')
async switchToActiveWorkspace(
  payload: ActiveWorkspaceBody,
): Promise<[APIResponse, ActiveWorkspaceResponse, ActiveWorkspaceBody]> {
  const [response, body, sentPayload] = await this.apiPOST<ActiveWorkspaceResponse, ActiveWorkspaceBody>(
    '/me/active-workspace',
    payload,
  );

  expect(response.status()).toBe(200);
  expect(body.id).toBe(payload.workspace_id);
  expect(body.slug).toBeDefined();
  expect(body.name).toBeDefined();

  return [response, body, sentPayload];
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|---|---|---|
| "User MUST be an active member of the target workspace" | EP (always) | BK-250 (active member → 200, this ATC), BK-251 (no membership → 403), BK-252 (suspended → 403) — three distinct partitions of the same input space, not one parameterized ATC, because the precondition state differs per partition (EP-merge only collapses *within* a partition) |

**Equivalence Partitioning detail:**

| Input (membership state) | Expected output | Same ATC? |
|---|---|---|
| active | 200 + context switch | No — this ATC (BK-250) |
| no row | 403 | No — BK-251 |
| suspended | 403 | No — BK-252 (different partition than "no row" even though both return 403 — the business reason differs, and BK-252 carries an extra DB assertion) |

BVA: N/A — no numeric range/limit/length/date-window on this endpoint's inputs (a UUID has no meaningful boundary).

## 7. Dependencies

- Precondition: `AuthApi.authenticateSuccessfully()` (existing, fixed 2026-08-03) for login; `AuthApi.getCurrentUser()` (existing helper) for workspace discovery and the post-switch verification read.
- Required Components: `WorkspaceApi` — new, this session.

## 8. Data Context

See automation-plan.md §4 — Discover pattern, zero setup, uses live staging data
(`Bünkāï QA` / `Extra Test`).

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `switchToActiveWorkspace`
- [x] Max 2 positional params — 1 (object param `payload`)
- [x] Correct return type — tuple `[APIResponse, TBody, TPayload]` for a POST
- [x] Fixed vs test-level assertions split (§4 above)
- [x] Not duplicating an existing ATC — checked `kata-manifest.json`, no `WorkspaceApi` exists yet
