# Automation Plan — DT-T13 / BK-487

Scope: regression-driven (single TC). Unblocked 2026-08-20 — see `spec.md` for the full unblock evidence.

## Component

Extend `tests/components/api/BugsApi.ts` — no new component file. `GET /api/v1/activity` is a generic, cross-domain read (not bug-specific), but a single-consumer helper does not justify a new `ActivityApi.ts` component yet; inline the read inside the new ATC. Promote to a standalone component the moment a second consumer needs it.

New types needed: `ActivityItemResponse` / `ActivityPageResponse`, sourced from `api/openapi-types.ts` (already synced 2026-08-20, `/api/v1/activity` present) via a new `api/schemas/activity.types.ts` facade, following the existing `bugs.types.ts` facade pattern (narrow re-export, not a hand-written duplicate).

## New ATC

```
@atc('BK-487')
async attributeActionToActualCaller(args: {
  bugId: string
  workspaceId: string
  action: BugWriteAction        // reuse existing union: { kind: 'assign', payload } | { kind: 'status', payload }
  expectedActorUserId: string
}): Promise<[APIResponse, ActivityItemResponse]>
```

Behavior:
1. POST the action (`/bugs/{bugId}/assign` or `/bugs/{bugId}/status`) via `this.apiPOST` — same dispatch as the existing `assign`/`status` ATCs. Fixed assertion: `response.status()` is 200.
2. GET `/activity` with `{ params: { workspace_id, limit: 50 } }` (no server-side entity filter exists — see spec.md "Known API limitation"). Fixed assertion: 200.
3. Find the item where `item.entity_id === bugId` AND `action === (kind==='assign' ? 'bug.assigned' : 'bug.status_changed')`. Fixed assertion: item exists (`toBeDefined()`), and `item.actor.user_id === args.expectedActorUserId`.
4. Return `[activityResponse, matchedItem]` for test-level composition (e.g. asserting `matchedItem.payload.assignee_user_id !== matchedItem.actor.user_id` when the row carries one, per the "never the assignee" clause).

Max-2-positional-params rule: 4 fields → object param, satisfies the rule.

## Test file

`tests/integration/bugs/attributeActionToActualCaller.test.ts` — model directly on `tests/integration/bugs/statusTransitions.test.ts` (same sandbox fixture, same `authenticateAs` local helper, same `fileFreshBug` local helper). Reuse the fixed constants already established there:

```ts
const BK264_SANDBOX_PROJECT_ID = '2fee236f-1246-40c4-bfc4-d332287f9548';
const BK264_SANDBOX_MODULE_ID = '175f8a08-20b9-4c96-a21a-e02dcae2837e';
const BK264_SANDBOX_MEMBER2_USER_ID = 'a8548f64-1aa8-43b1-9a5b-c44b27c4782a'; // matches STAGING_MEMBER_EMAIL
const BK264_SANDBOX_WORKSPACE_ID = '6646f244-a28c-441e-8486-9af33bdb5c11'; // "BK-264 QA Sandbox" — confirmed live 2026-08-20
```

Two rows, single parameterized `test.describe` per EP (2 distinct actor/action pairs — different action AND different expected actor, so NOT collapsible into one parameterized call; matches the doctrine's "split when action/state differs" rule):

1. **owner → assign**: `authenticateAs(owner)`, file a fresh bug, `attributeActionToActualCaller({ bugId, workspaceId, action: { kind: 'assign', payload: { assignee_user_id: MEMBER2 } }, expectedActorUserId: OWNER_USER_ID })`. Test-level assertion: matched item's actor `!==` the assignee (`MEMBER2`) — proves non-spoofability.
2. **member → status change**: after row 1's assign, `authenticateAs(member)`, `attributeActionToActualCaller({ bugId, workspaceId, action: { kind: 'status', payload: { status: 'in_progress' } }, expectedActorUserId: MEMBER2_USER_ID })`.

`OWNER_USER_ID` needs resolving — not yet a known constant in this repo's fixtures (siblings only use it as the "current session" implicitly). Resolve via `GET /me` after `authenticateAs(owner)` (existing `AuthApi` or `WorkspaceApi` helper — check for a `getCurrentUser`/`me` helper before adding a new one) rather than hardcoding a 5th UUID constant.

## Fixture

`{ api }` — API-only, no browser (per `spec.md` Architecture: API-only).

## Data strategy

Generate pattern — fresh bug per row via `fileFreshBug` (already established in `statusTransitions.test.ts`), reusing the existing `BK264_SANDBOX_PROJECT_ID`/`MODULE_ID`/`MEMBER2_USER_ID` constants rather than minting new ones (Discover pattern for the workspace/project/member fixtures — they're stable sandbox data, not throwaway).

## Verification checklist

- [ ] `bun run test tests/integration/bugs/attributeActionToActualCaller.test.ts`
- [ ] `bun run types:check`
- [ ] `bun run lint:check`
- [ ] `bun run kata:manifest` (regenerate) + `bun run kata:manifest:check` (confirm clean)
