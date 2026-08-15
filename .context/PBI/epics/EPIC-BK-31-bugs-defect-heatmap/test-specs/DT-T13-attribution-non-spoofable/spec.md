# DT-T13: Attribute an action to the actual calling actor, not the bug's assignee

| Field | Value |
|-------|-------|
| **Priority** | Medium |
| **Phase** | Standalone (regression-driven, single TC) |
| **Items** | 1 TC |
| **Dependencies** | None |
| **Requires** | Owner identity + Member identity that can both log in; DBHub read access to `activity_log` (see Architecture Decision below) |
| **Source** | Story: BK-264 / TC: BK-487 |

## Summary

Validates a beyond-AC risk (audit-trail integrity / non-spoofable attribution): `activity_log.actor_user_id` must always match the identity that actually made the call, never the bug's assignee or a third party. Verified for 2 actor/action pairs: owner performing assign, member performing status-change.

## Status: BLOCKED (no read surface, no DB client in test runtime)

**Finding (Plan phase, 2026-08-15)**: no API surface exposes bug-action attribution. `GET /api/v1/activity`'s own OpenAPI description states "no defect activity" and its `ActivityItem` union has zero bug-related event types (only module/atc/test/run events). `BugDetail` carries no actor/performed-by field distinct from `created_by`/`assignee_user_id`. The only place `activity_log.actor_user_id` exists is the database.

**First-pass mitigation considered and rejected**: querying `activity_log` directly at test-level via DBHub. Corrected mid-plan — DBHub is an MCP tool, only callable by the AI agent, NOT importable inside the compiled `bun test` runtime. A real automated check would need a genuine DB client dependency (`pg` or similar) wired into `config/variables.ts` against the existing `DBHUB_*` env vars — that is `/framework-development` scope (new dependency, new config surface, connection lifecycle), not a test-level tweak, and out of scope for this regression-driven automation pass.

**Decision (user, 2026-08-15)**: BLOCKED for now. Do not automate. Two unblock paths, either is sufficient:
1. Product adds a bug-action read surface (e.g. `GET /api/v1/activity` gains `bug.assigned` / `bug.status_changed` event types, or a dedicated `GET /bugs/{id}/activity`).
2. `/framework-development` adds a real DB client to the test runtime (reusable beyond this one TC — any future audit/attribution TC benefits).

No code was written for this TC. `BK-487` stays in TMS as Candidate but automation is deferred — flag in Jira as Blocked with this note, do not silently drop it.

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

- [ ] BLOCKED — not automated this pass. Jira BK-487 commented with the blocker + unblock paths above.
- [ ] Revisit once either unblock path lands.
