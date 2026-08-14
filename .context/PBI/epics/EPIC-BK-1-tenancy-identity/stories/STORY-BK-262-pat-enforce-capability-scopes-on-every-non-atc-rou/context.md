# BK-262: PAT | Enforce capability scopes on every non-ATC route
**Ticket:** BK-262 | **Module (= Epic):** BK-183 QA Defect Management | **Status:** Shift-Left QA | **Sprint:** n/a — pre-sprint

## Acceptance Criteria (original)
- AC1: A properly-scoped token succeeds on a non-ATC route (module create)
- AC2: An under-scoped token is rejected before any change happens (invite create)
- AC3: A token with no resolvable workspace context is rejected

## Team Discussion (from comments)
- Ely (8/11/2026): AI Tech Lead pointer — BK-97's two published rulings (PAT scope vocabulary kept as-is; enforcement shape = per-route `requires` + type-level default-deny + coverage snapshot, shipped as a 5-slice chain) already decide this Story's design questions. Measured gap as of 8/11: 82 handlers using `withApiHandler`, 25 declare `requires`, 49 omit it entirely (the gap). Flags that `app/api/v1/projects/[id]/traceability/route.test.ts:127-134` currently asserts 201 for an under-scoped PAT on a non-ATC route and must be updated as part of this Story.
- Ely (8/13/2026): Carries over BK-97 comment 12195 in full (AI Tech Lead — enforcement-shape decision, alternatives scored, 5-slice sizing, test strategy) since BK-97 was closed as a duplicate of this issue.

## Parent epic
BK-183: QA Defect Management (note: a QA-process epic, not a product/security epic — flagged as a data-hygiene question in shift-left-refinement.md)

## Pre-sprint status
Shift-Left refinement: in progress (started 2026-08-14)
