# ATC Spec: BK-486 — rejectWriteActionForViewer

> Ticket: BK-486 (TC7, TMS test case for Story BK-264)
> Component: BugsApi (tests/components/api/BugsApi.ts) — EXTEND existing component
> Type: API — Mutation, negative/authorization path
> Parent Story: BK-264

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| rejectWriteActionForViewer | Reject assign/status-change when actor is a Viewer-role member | Bug exists; actor is active viewer | beyond-AC (authorization boundary) |

## 2. ATC Contract

```typescript
/**
 * ATC: Reject a write action (assign or status-change) from a Viewer-role actor — expects 403
 * Fixed assertions:
 *  - response.status() === 403
 *  - body.error.code === 'forbidden'
 *  - body.error.details.reason === 'not_a_member'
 */
@atc('BK-486')
async rejectWriteActionForViewer(
  bugId: string,
  action: { kind: 'assign', payload: BugAssignBody } | { kind: 'status', payload: BugStatusTransitionBody },
): Promise<[APIResponse, BugError]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `POST /api/v1/bugs/{id}/assign` OR `POST /api/v1/bugs/{id}/status` (parametrized by `action`) |
| OpenAPI Type(s) | `BugAssignBody`, `BugStatusTransitionBody`, `BugError` from `@schemas/bugs.types` |
| Auth Required | Yes — actor authenticated as `STAGING_VIEWER_EMAIL` (role `viewer`) |
| Return Pattern | Tuple: `[APIResponse, BugError]` (no payload echo needed — this is a rejection path) |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 403`
- `body.error.code === 'forbidden'`
- `(body.error.details as { reason?: string } | undefined)?.reason === 'not_a_member'`

### Test-level (in test file)
- `GET /bugs/{id}` (via a new `getBugById` helper) confirms the bug's `status`/`assignee_user_id` are unchanged after the rejected call — composes 2 endpoints, so it's test-level per KATA Rule 6.

## 5. Code Template

```typescript
// New read-only helper (no @atc) — needed by both this TC and the test-level
// "unchanged" assertion.
@step
async getBugById(bugId: string): Promise<[APIResponse, { bug: BugDetail }]> {
  return this.apiGET<{ bug: BugDetail }>(`/bugs/${bugId}`);
}

@atc('BK-486')
async rejectWriteActionForViewer(
  bugId: string,
  action: { kind: 'assign', payload: BugAssignBody } | { kind: 'status', payload: BugStatusTransitionBody },
): Promise<[APIResponse, BugError]> {
  const endpoint = action.kind === 'assign' ? `/bugs/${bugId}/assign` : `/bugs/${bugId}/status`;
  const [response, body] = await this.apiPOST<BugError, BugAssignBody | BugStatusTransitionBody>(
    endpoint,
    action.payload,
  );
  expect(response.status()).toBe(403);
  expect(body.error.code).toBe('forbidden');
  expect((body.error.details as { reason?: string } | undefined)?.reason).toBe('not_a_member');
  return [response, body];
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|----|------------------|-----------------|
| beyond-AC (viewer write rejection) | EP (always) — assign and status-change share the same 403/not_a_member outcome shape | 1 parameterized `@atc('BK-486')`, 2 Examples rows |

**Equivalence Partitioning detail:**

| Input (endpoint) | Expected output | Same ATC? |
|---|---|---|
| `/assign` | 403, forbidden, not_a_member | Yes |
| `/status` | 403, forbidden, not_a_member | Yes — same behavior shape, merged into the same parameterized ATC |

**Boundary Value Analysis detail**: N/A — no range/limit/length/date-window involved.

**Two reduction axes**: only EP fires (2 actions, same outcome) — 1 parameterized ATC, 2 rows, no further reduction needed.

## 7. Dependencies

- Precondition Steps: none — reuses `fileBugSuccessfully` (existing helper, Generate pattern) as the owner to create the target bug, then re-authenticates as the viewer for the action.
- Required Components: `BugsApi` (extend) — adds `getBugById` helper + `rejectWriteActionForViewer` ATC.
- Second identity: `STAGING_VIEWER_EMAIL` / `STAGING_VIEWER_PASSWORD` from `.env`, read via `config.testViewer` (`@variables`) — provisioned this session (bk264-viewer2, role viewer, "BK-264 QA Sandbox" workspace).

## 8. Data Context

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Workspace + viewer identity | **Discover** | `BK-264 QA Sandbox` (`6646f244-a28c-441e-8486-9af33bdb5c11`); viewer = `config.testViewer` | `beforeAll`/inline | None — stable, reused across runs |
| Open bug | **Generate** | `POST /bugs` as the sandbox owner (`fileBugSuccessfully`), fresh per test run | Test-level | None needed |

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `rejectWriteActionForViewer`
- [x] Max 2 positional params — `(bugId, action)`
- [x] Correct return type — tuple `[APIResponse, BugError]`
- [x] Fixed vs test-level assertions split
- [x] Not duplicating an existing ATC — `kata-manifest.json` confirmed `BugsApi` has only `BK-477` so far
