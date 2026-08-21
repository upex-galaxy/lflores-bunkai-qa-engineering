# test-documentation — BK-498 — Coverage Matrix

**Story:** BK-498 — PAT | Enforce capability scopes on the authoring domain
**Modality:** jira-native (no Xray)
**Regression Epic:** BK-70 (QA Test Repository)
**Date:** 2026-08-21

## AC -> Outline -> TC traceability

| AC | Outline | TC Key | Title | Priority | ROI | Verdict |
|---|---|---|---|---|---|---|
| AC-01 | R1 | BK-556 | should create module successfully given a PAT scoped exactly atc:write | Highest | 25.0 | Candidate |
| AC-03 | R2 | BK-560 | should reject module creation with 403 and no side effect given a PAT scoped exactly atc:read | Highest | 25.0 | Candidate |
| AC-07 | R3 | BK-562 | should create module successfully given an unbound atc:write PAT held by a real workspace member | High | 16.0 | Candidate |
| AC-08a | R4 | BK-564 | should list user stories successfully given a PAT scoped atc:read | High | 16.0 | Candidate |
| risk-beyond-AC | R5 | BK-565 | should reject a read request with 403 given a PAT scoped only atc:write | Medium | 12.0 | Candidate |
| risk-beyond-AC | R6 | BK-567 | should return 401 unauthenticated when no token is presented, distinct from the 403 capability rejection | High | 16.0 | Candidate |
| risk-beyond-AC | R7 | BK-569 | should reject module creation with a membership-403 given a correctly-scoped atc:write PAT whose user is not a workspace member | High | 16.0 | Candidate |
| non-regression control | R8 | BK-570 | should continue succeeding on both read and write given a default-scoped PAT | High | 16.0 | Candidate |
| non-regression control | R9 | BK-557 | should create module successfully via an authenticated browser session regardless of any PAT scope restriction | Highest | 25.0 | Candidate |
| Error Guessing | R10 | BK-558 | should return 401 for a revoked atc:write token, distinct from the 403 an under-scoped-but-valid token receives | Medium | 12.0 | Candidate |
| wiring sweep (5 families) | TC11 | BK-559 | should reject writes across all authoring families given a PAT scoped exactly atc:read | High | 16.0 | Candidate |
| wiring sweep (5 families) | TC12 | BK-561 | should accept writes across all authoring families given a PAT scoped exactly atc:write | High | 16.0 | Candidate |
| wiring sweep (5 families) | TC13 | BK-563 | should accept reads across all authoring families given a PAT scoped exactly atc:read | High | 16.0 | Candidate |
| wiring sweep (5 families) | TC14 | BK-566 | should reject reads across all authoring families given a PAT scoped exactly atc:write (write-only token) | High | 16.0 | Candidate |
| Import positive control | TC15 | BK-568 | should complete a full import lifecycle (create then poll) successfully given a PAT scoped both atc:write and atc:read | High | 16.0 | Candidate |

**Total: 15 outlines -> 15 TCs -> 15 Candidate, 0 Manual, 0 Deferred.** 4 formal ACs (AC-01/03/07/08a) covered directly (R1-R4); the remaining 11 are risk-beyond-AC, non-regression controls, or parametrized wiring-correctness sweeps covering the other 18 handlers (TC11-TC14, 5 endpoint-rows each). All 22 authoring-domain handlers have regression coverage either directly (Modules family) or via the representative-row sweep.

## Every TC verified (all fields, post-creation)

- Parent epic: BK-70 (QA Test Repository) — 15/15 ✓
- Story link: `is tested by` BK-498, direction verified via REST `issuelinks` — 15/15 ✓
- Status: Candidate (Draft→In Design→Ready→In Review→Candidate) — 15/15 ✓
- Description: full template applied (Related Story, Priority/ROI, Prior bugs, Test Design, Gherkin, Variables, Implementation Code, Architecture, Available Test IDs, Refinement Notes) — 15/15 ✓
- Labels: `regression`, `automation-candidate`, `integration` + priority label — 15/15 ✓
- Components: per-family mapping (Bunkai Modules / User Stories / Acceptance Criteria / Environments / Milestones / Imports) + Bunkai API Tokens or Bunkai Auth on every TC — 15/15 ✓
- Local cache: `.context/PBI/epics/EPIC-BK-1-tenancy-identity/stories/STORY-BK-498-pat-enforce-capability-scopes-on-the-authoring-dom/test-cases/*.md` — 15/15 ✓

## Handoff to /test-automation

Scope: **ticket-driven** (Medium scope per test-automation's re-scoping table). All 15 TCs are Candidate and ready for automation — API-only (curl/Playwright `request` fixture), no UI. Suggested grouping for implementation: one ATC per TC, reusing a shared `mintNarrowScopedPat` helper (4 narrow PATs + 1 dual-scope + 1 revoked, per `test-session-memory.md`'s proven Stage-2 minting flow) and the existing default-scope `.auth/tokens.env` OWNER token for TC8/TC13's non-regression legs.

## Gotchas discovered this session (for reuse by future test-documentation runs on this project)

1. This Jira instance's Priority scheme has no `Critical` value — only `Highest/High/Medium/Low/Lowest`. Map `Critical -> Highest` when a design doc (ATP) uses "Critical".
2. `acli jira workitem create`/`edit` expose no `--priority`/`--components`/`--parent`(epic) flags on this acli version. Set them via `additionalAttributes` in a `--from-json` create payload (`priority: {name: ...}`, `components: [{name: ...}]`, `parent: {key: "BK-70"}`) — cleaner than the REST-PUT-after-create fallback.
3. `acli jira workitem link create` requires the long-form `--yes` (`-y` is rejected on this subcommand, unlike `transition` which accepts both).
4. `acli jira workitem link list`'s `outwardIssueKey` was unreliable (`null`) for the `Test` link type on this instance — verify link direction via a direct `view`/REST read of the Story's `issuelinks`, filtering `type.inward == "is tested by"` + `inwardIssue.key`, not via `link list`.
5. The `Test` issue type's numeric id on this instance is `10006` (not `10009`, which is `Test Execution`) — irrelevant if creating by name, but worth correcting if any script hardcodes the id.
