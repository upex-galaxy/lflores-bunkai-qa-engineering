# ATC Spec: BK-252 — switchToSuspendedWorkspace

> Ticket: BK-6
> Component: WorkspaceApi (tests/components/api/WorkspaceApi.ts)
> Type: API — Mutation (negative path)
> Parent Story: BK-6

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| switchToSuspendedWorkspace | Verify a user CANNOT switch their active workspace to one where their membership `status = 'suspended'` | Authenticated; target workspace exists, caller HAS a `workspace_members` row, but `status = 'suspended'` | Response 403 `{error:{code:'forbidden',message}}`; `GET /me` still reflects the PRE-switch `active_workspace_id` (session did not rotate) |

## 2. ATC Contract

```typescript
/**
 * ATC: POST /me/active-workspace with a target where the caller's membership is suspended.
 * Fixed assertions:
 *  - 403 Forbidden
 *  - body.error.code === 'forbidden'
 */
@atc('BK-252')
async switchToSuspendedWorkspace(
  payload: ActiveWorkspaceBody,
): Promise<[APIResponse, ActiveWorkspaceError, ActiveWorkspaceBody]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `POST /me/active-workspace` |
| Request body | `{ workspace_id: string (uuid) }` — a real workspace, caller has a membership row with `status = 'suspended'` |
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
@atc('BK-252')
async switchToSuspendedWorkspace(
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
is the "suspended membership" partition (distinct from BK-251's "no row" partition, even
though both return 403; the business reason and DB state differ — no row vs. a row with
`status != 'active'`).

## 7. Data Context — Modify, hand-mutated once, documented reserved fixture

**Architecture gap** (same one found for BK-251, see `atc/BK-251-switch-non-member-workspace.md`
§7): this KATA framework has no runtime DB client wired into `tests/`. For BK-251 that only
blocked a *read*; for BK-252 the original automation-plan strategy ("Modify via `UPDATE
workspace_members SET status='suspended'` in `beforeAll`, restore in `afterAll`") requires an
actual *write* the test code cannot perform at runtime either way.

**Options weighed with user (2026-08-07)**:
1. Hand-mutate once outside the test, document as a permanent reserved fixture (like BK-251's
   `WORKSPACE_NOT_MEMBER_ID`) — no framework code change.
2. Build a minimal DB-write capability into the framework (`beforeAll`/`afterAll` mutate +
   restore) — ADR-worthy per `test-automation` anti-pattern #17 (reused across 2+ tickets: this
   would be the second ATC needing DB Modify after none yet existed).
3. Defer BK-252, move to BK-253 (UI/e2e) — rejected, BK-253 is separately blocked on
   `LoginPage.ts` fictional selectors, does not resolve this decision.

**Resolution — Option 1 confirmed by user**: hand-mutated once via `QA_INSPECTOR_RW_URL`
(direct psql, RW credential — the `staging-dbhub` MCP connection is READ-ONLY, confirmed by a
`permission denied for table workspace_members` probe before falling back to
`QA_INSPECTOR_RW_URL`). Same RW credential already used once before, manually, during BK-6's
original Stage 2/3 sprint-testing session for TC3 (see Story `context.md` → "Open Questions
(Resolved)" #1) — that prior use was **restored** after the manual TC; this one is **not**
restored, because it now serves as a **permanent regression fixture**, not a one-off manual
check.

- Workspace: `BK5 Test Workspace` — id `c828d131-f1c7-413c-9ba4-723fa1c45c00`
- Caller: BK-6 test user, id `2742da39-e0ff-4f0c-a0a1-88dae804e14f`
  (`bunkai-staging-userlf@ambuusteln.resend.app`), role `owner`
- Mutation applied 2026-08-07: `workspace_members.status` `active` → `suspended` for this
  `(workspace_id, user_id)` pair. Verified via `SELECT` immediately after — row confirmed
  `status = 'suspended'`.
- Reserved fixture — same convention as `WORKSPACE_NOT_MEMBER_ID` (BK-251). Do **NOT**
  reactivate this membership, do NOT delete the workspace or the row. Doing so breaks this
  TC with a false result, not a real regression. This workspace is also therefore
  **excluded** from BK-250's active-workspace discovery pool going forward (its membership
  is no longer `active`) — confirmed BK-250's `Discover` logic (`meBefore.workspaces`, only
  populated with active memberships) does not hardcode workspace names, so this does not
  break BK-250 (still >= 2 active memberships: `Bünkāï QA`, `Extra Test`).
- Constant lives in the test file (`WORKSPACE_SUSPENDED_ID`), not `DataFactory` — it is a
  fixed environment reference, not generated data.

**Not promoted to ADR**: this is the SECOND ATC needing a documented-fixed-reference
workaround for the same underlying gap (no runtime DB client), but both resolutions are
identical in shape (permanent DB-state fixture + documented constant) and required zero
framework code changes. Revisit as ADR-worthy only if a THIRD case requires an actual
runtime mutation (e.g., a test that must restore state between runs) — that is qualitatively
different and was explicitly deferred as Option 2 above.

## 8. Dependencies

- Precondition: `AuthApi.authenticateSuccessfully()` (existing) for login;
  `AuthApi.getCurrentUser()` (existing helper) for the pre/post `active_workspace_id`
  comparison.
- Required Components: `WorkspaceApi` — existing (extends with this ATC).

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `switchToSuspendedWorkspace`
- [x] Max 2 positional params — 1 (object param `payload`)
- [x] Correct return type — tuple `[APIResponse, TBody, TPayload]` for a POST
- [x] Fixed vs test-level assertions split (§4 above)
- [x] Not duplicating an existing ATC — checked `kata-manifest.json`, only BK-250/BK-251 exist
