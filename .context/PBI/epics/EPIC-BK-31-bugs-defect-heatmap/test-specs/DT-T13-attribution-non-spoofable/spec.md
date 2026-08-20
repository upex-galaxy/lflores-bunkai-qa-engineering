# DT-T13: Attribute an action to the actual calling actor, not the bug's assignee

| Field | Value |
|-------|-------|
| **Priority** | Medium |
| **Phase** | Standalone (regression-driven, single TC) |
| **Items** | 1 TC |
| **Dependencies** | None |
| **Requires** | Owner identity + Member identity that can both log in; `GET /api/v1/activity` read access (see Unblock below) |
| **Source** | Story: BK-264 / TC: BK-487 |

## Summary

Validates a beyond-AC risk (audit-trail integrity / non-spoofable attribution): `activity_log.actor_user_id` must always match the identity that actually made the call, never the bug's assignee or a third party. Verified for 2 actor/action pairs: owner performing assign, member performing status-change.

## Status: UNBLOCKED (2026-08-20) — proceeding to Code phase

**Original finding (Plan phase, 2026-08-15)**: no API surface exposed bug-action attribution. `GET /api/v1/activity`'s own OpenAPI description stated "no defect activity" and its `ActivityItem` union had zero bug-related event types. `BugDetail` carried no actor field distinct from `assignee_user_id`. Decision: BLOCKED, do not automate. Jira BK-487 commented with the blocker + 2 unblock paths.

**Unblock path 1 landed** (re-verified 2026-08-20, code-level + live): `lib/activity/constants.ts`'s `ACTIVITY_ALLOWED_ACTIONS` in `upex-bunkai-tms` (`staging`, HEAD `67f76b3`) now includes `bug.assigned` / `bug.reassigned` / `bug.unassigned` / `bug.status_changed` (merged 2026-07-31/08-03, BK-49 + BK-264 Slice 4 — never merged to `main`, only `staging`, which is why the Plan-phase check missed it). `app/api/v1/activity/response.ts:195` returns `actor: { user_id, email }` per item, resolved separately from `assignee_user_id`.

**Empirically confirmed live** against `https://staging-upexbunkai.vercel.app` (workspace `BK-264 QA Sandbox`, `6646f244-a28c-441e-8486-9af33bdb5c11`), `GET /api/v1/activity?workspace_id={id}&limit=50` returns items shaped exactly as needed:

```json
{
  "entity_type": "bug",
  "action": "bug.status_changed",
  "actor": { "user_id": "2742da39-...", "email": "bunkai-staging-userlf@..." },
  "item": { "entity_id": "<bug_id>" },
  "payload": { "status": "in_progress", "previous_status": "open", "assignee_user_id": null }
}
```

`actor.user_id` is the true performer; `payload.assignee_user_id` (when present) is the bug's assignee — the two are already structurally distinct fields, satisfying the TC's core assertion without any DB client.

**Known API limitation (design around it, not a blocker)**: no `entity_id`/`entity_type` query filter exists — only `workspace_id` / `limit` / `cursor`. The ATC must page the feed (`limit=50`, newest-first) and filter client-side in test code for the row matching the freshly created `bug_id` + expected `action`, rather than querying by bug directly.

Unblock path 2 (`/framework-development` DB client) was NOT taken — not needed now that path 1 landed.

## Preconditions

- A bug exists in the target workspace.
- Two identities available: the workspace owner (`STAGING_USER_EMAIL`) and an active `member`-role identity (`STAGING_MEMBER_EMAIL`) that can both log in.

## Test Cases

### BK-487: should attribute an action to the actual calling actor, not the bug's assignee

**Preconditions**: Bug exists in `{workspace_id}`.
**Action**: `<actor_role>` performs `<action>` on the bug via its dedicated endpoint.
**Expected Output**:
- `activity_log.actor_user_id` matches the actual calling identity — never the bug's assignee or a third party
- Verified for 2 distinct actor/action pairs

```gherkin
Scenario Outline: BK-487 - should attribute an action to the actual calling actor, not the bug's assignee
  Given a bug exists in workspace "{workspace_id}"
  When "<actor_role>" performs "<action>" on the bug via its dedicated endpoint
  Then activity_log.actor_user_id matches the "<actor_role>" identity that made the call
  And activity_log.actor_user_id does not match the bug's assignee_user_id, when different, or any third party

  Examples: Actor / action pairs
    | actor_role | action                          |
    | owner      | assign (POST .../assign)        |
    | member     | status change (POST .../status) |
```

---

## Acceptance Criteria

- [x] Unblocked 2026-08-20 — `GET /api/v1/activity` confirmed live to expose `actor.user_id` distinct from `payload.assignee_user_id` for `bug.assigned`/`bug.status_changed`.
- [ ] ATC implemented in `tests/components/api/BugsApi.ts` (or a new `ActivityApi.ts` helper), reusing existing `assignBugToEligibleMember` (`BK-477`) / `advanceStatusLegally` (`BK-479`) ATCs as the Action step.
- [ ] Both actor/action pairs covered (owner→assign, member→status-change), parameterized per EP (same assertion shape, different actor+action -> one parameterized ATC per doctrine).
- [ ] Review gate green (`test`, `types:check`, `lint:check`).
