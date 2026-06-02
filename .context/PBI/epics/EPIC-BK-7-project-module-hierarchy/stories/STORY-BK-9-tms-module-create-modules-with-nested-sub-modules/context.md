# BK-9: TMS-Module | Create modules with nested sub-modules

**Ticket:** BK-9 | **Module:** project-module-hierarchy | **Status:** Shift-Left QA | **Sprint:** n/a — pre-sprint

## Acceptance Criteria (original)

- AC1: Create a top-level Module inside a Project — module appears at root level and is selectable as parent for sub-modules
- AC2: Create a nested sub-module under an existing Module — appears nested with correct breadcrumb (e.g., "Payment / Refunds")
- AC3: Module name shorter than minimum (< 2 chars) is rejected with validation message
- AC4: Nesting beyond 4 levels shows a soft, non-blocking warning but creation succeeds (creating at level 5)
- AC5: Nesting beyond maximum depth (creating at level 7) is blocked with error "maximum nesting depth is 6 levels"

## Team Discussion (from comments)

No team discussions found.

## Parent epic

BK-7: Project & Module Hierarchy

## Pre-sprint status

Shift-Left refinement: in progress (started 2026-06-02)
