# BK-264: TMS-Defect Triage | Assign a defect to a workspace member and update its status
**Ticket:** BK-264 | **Epic/Module:** EPIC-BK-31-bugs-defect-heatmap | **Status:** Ready For QA | **Sprint:** -

> Jira-sourced detail (read-only caches, not copied here): `story.md`, `acceptance-criteria.md`, `comments.md`, `business-rules.md`, `scope.md`, `out-of-scope.md`, `implementation-plan.md` — materialized by `bun run jira:sync-issues get BK-264 --include-comments`.

## Team Discussion (analysis only — source is comments.md)

### Key Decisions
- [Ely] (8/3/2026): Workload forecast resolved via the git-flow-master chained-PR decision tree — chain strategy `feature-branch-chain`. Driven by a shared DB layer (new `assignee_user_id` column + two `SECURITY DEFINER` RPCs) that both the API and UI slices depend on, plus a total review estimate (~2118 lines) that stays over the per-slice budget even split across the 4 natural layers.
- [Ely] (8/3/2026): Merged to `staging` via PR #114, branch `feat/BK-264-defect-triage`; deployed in the same session as BK-209. Explicitly noted: **"This story was created mid-sprint as a prerequisite for BK-212 — no shift-left QA phase, left unassigned."**

### Technical Notes
- Branch plan executed as 4 slices inside one integration branch: Slice 1 DB (migration `0054_bug_assignment_status.sql` — column, 2 RPCs, trigger backstop), Slice 2 API (assign/status routes + error mapping), Slice 3 UI (assignee picker + status-action control on the existing bugs list), Slice 4 Activity feed wiring (4 new activity actions).
- Migration numbered `0054`, not `0053` — `0053_notifications.sql` already existed on `origin/staging` from the parallel BK-209 branch at merge time.

### Edge Cases Raised
- None raised in comments beyond what's already codified in the ACs / business rules (skip-stage, backward-move, non-member, Viewer-only rejections).

## Related Code
### Backend (`../upex-bunkai-tms`)
- `supabase/migrations/0054_bug_assignment_status.sql` — adds `bugs.assignee_user_id`, new index, extends `bunkai_bugs_check_consistency` trigger (status-adjacency + assignee-eligibility backstop), new RPCs `bunkai_assign_bug` / `bunkai_transition_bug_status` (both `SECURITY DEFINER`, no actor param — read `auth.uid()` directly).
- `app/api/v1/bugs/[id]/assign/route.ts`, `app/api/v1/bugs/[id]/status/route.ts` — `POST`, `atc:write` scope.
- `lib/bugs/errors.ts` — new SQLSTATE mappings 45310 (skip-stage) / 45311 (backward) / 45312 (non-member) / 45313 (Viewer-only), verbatim AC wording.
- `lib/supabase/rpc.ts` — `assignBug`, `transitionBugStatus` wrappers.
- `lib/bugs/validation.ts` — `BugAssignBodySchema`, `BugStatusBodySchema`.
- `app/api/v1/bugs/list-response.ts` — adds `assignee_user_id` + resolved assignee email to the list row shape.

### Frontend (`../upex-bunkai-tms`)
- `components/bugs/BugsListView.tsx` — assignee cell (email or "Unassigned") + status action button (single next-stage label, no dropdown — skip/backward structurally unreachable from the UI).
- `components/bugs/BugAssignControl.tsx` (new) — member picker, write-role only; Viewers see it read-only.
- `lib/bugs/list-view.ts` — `assigneeUserId` / `assigneeEmail` / `nextStatus` derivation.
- `lib/activity/constants.ts`, `lib/activity/labels.ts`, `app/api/v1/activity/response.ts` — 4 new activity actions (`bug.assigned` / `bug.reassigned` / `bug.unassigned` / `bug.status_changed`).

### Database (Supabase Postgres)
- Tables: `bugs` (new `assignee_user_id uuid references auth.users(id) on delete set null`), `workspace_members` (source of the eligibility check — `status='active'`, `role != 'viewer'`).
- Triggers: `bunkai_bugs_check_consistency` (extended — DB-level backstop, not just app validation), `activity_log_notify_bug_event` (fires a `notifications` row on assign/reassign/unassign/status_changed — the exact event BK-212 will subscribe to).

## TMS Artifacts
| Artifact | ID | Status |
|----------|----|--------|
| ATP | Done | Created in Stage 1 (synced acceptance-test-plan.md) |
| ATR | Done | Created in Stage 3 (synced acceptance-test-results.md) — result PASSED |

## Open Questions

- **Process gap (flag, not blocker):** BK-264 reached "Ready For QA" with NO `shift-left-reviewed` label and NO Story Points set (`story.md`: `Story Points: -`). Comments confirm this was intentional — "created mid-sprint as a prerequisite for BK-212 — no shift-left QA phase, left unassigned." The dev-side implementation plan sizes it at ~4 days / ~5 SP as its own placeholder (`implementation-plan.md` Open Questions), not a PO planning-poker result. Testing proceeds normally; this is a backlog-hygiene gap to note, not a reason to stop.
- **Test-data gap for role-based ACs (carried to Stage 1 Planning):** ACs 1, 8, 9, 10 need at least 2 distinct workspace-member identities with different access levels (Member vs Viewer-only) to exercise assign / reassign / Viewer-rejection. Only ONE staging test-user account exists in `.env` (`STAGING_USER_EMAIL` / `STAGING_USER_PASSWORD`). Open question for Stage 1: seed a second identity via `[DB_TOOL]`, or reuse an existing staging workspace member with a known role?
- Domain glossary has no "assignee"/"defect assignment" entry yet (dev plan Decision 8) — flagged for a future glossary/`/business-data-map` refresh, not a testing blocker.
- `business-data-map.md` §4.4 depicts a `closed → open` reopen path broader than this story's ratified scope — `out-of-scope.md` explicitly excludes reopen ("no current source defines this behavior; flagged separately for the PM to decide"). Confirms reopen is NOT in scope for this pass.
- BK-212 (Notifications, sibling story, also Ready For QA) consumes the `activity_log_notify_bug_event` payload shape this story produces — worth a quick cross-check if BK-212 is tested in the same session.

## Session Notes
### Session 1 — 2026-08-14
Context loaded from synced Jira fields (story, ACs, business rules, scope, out-of-scope, implementation plan, comments) + project-wide context (`master-test-plan.md` §2.7/§3.4, `business-data-map.md`, `business-feature-map.md` FEAT-048 "Bug Assignment & Status Transition" — already documented as ✅ Stable/Live post-implementation). Environment (staging) reachability already gated by the orchestrator before this session (web 307, api 200) — not re-probed here. No module-context.md exists yet for EPIC-BK-31 — full module exploration deferred to Stage 1 Planning if needed.

## Final Status

**Result:** PASSED
**Workflow Complete:** 2026-08-14
**Next:** QA Approved
