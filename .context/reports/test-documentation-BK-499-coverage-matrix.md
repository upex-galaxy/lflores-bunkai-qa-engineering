# test-documentation — BK-499 — Coverage Matrix

**Story:** BK-499 — PAT | Enforce capability scopes on read, identity and notification routes
**Modality:** jira-native (no Xray) — Test Plan / Test Set / Test Execution work types present, item-first path used
**Regression Epic:** BK-70 (QA Test Repository)
**ATS (Test Set):** BK-668 · **ATP (Test Plan):** BK-669 · **ATR (Test Execution):** BK-670
**Date:** 2026-08-28

## AC -> Outline -> TC traceability

| AC | Outline | TC Key | Title | Priority | ROI | Verdict |
|---|---|---|---|---|---|---|
| AC1 | 1 | BK-671 | should create workspace given PAT holds at least one scope | Highest | 64 | Candidate |
| AC1 (Finding B) | 2 | BK-672 | should reject token issuance given zero scopes requested | Medium | 9 | Candidate |
| AC2/AC3 | 3 | BK-673 | should return 200 with data given PAT scoped atc:read | Highest | 25 | Candidate |
| AC2/AC3 | 4 | BK-674 | should return 403 given PAT missing atc:read | Highest | 25 | Candidate |
| boundary | 5 | BK-675 | should reject given PAT scoped atc:write only on a read-gated route | Highest | 60 | Candidate |
| boundary | 6 | BK-676 | should pass given PAT holds required scope plus an unrelated extra scope | Low | 16 | Candidate |
| AC4 | 7 | BK-677 | should succeed for any authenticated PAT regardless of scope given identity or notification route | Medium | 24 | Candidate |
| AC5 | 8 | BK-678 | should reject Bearer PAT on DELETE workspace membership | Highest | 48 | Candidate |
| AC5 (Finding A) | 9 | BK-679 | should reject Bearer PAT on POST active-workspace with the browser-session message | Highest | 48 | Candidate — **known failing, tied to BK-623** |
| AC5 | 10 | BK-680 | should succeed via browser session on session-only routes | Medium | 18 | Candidate |
| AC6 | 11 | BK-681 | should serve a capability-gated route to a browser session with no scope check | Highest | 64 | Candidate |
| AC7 | 12 | BK-682 | should reject owner-role PAT missing required capability | Highest | 15 | Candidate |
| AC7 | 13 | BK-683 | should accept viewer-role PAT holding required capability | Medium | 9 | Candidate |
| AC8 | 14 | BK-684 | should create project given PAT scoped atc:write and member role | Medium | 12 | Candidate |
| AC8 | 15 | BK-685 | should reject given PAT missing atc:write checked before membership | Highest | 15 | Candidate |

**Total: 15 outlines -> 15 TCs -> 15 Candidate, 0 Manual, 0 Deferred.** ROI range 9-64 (threshold for Candidate is 3.0) — the unusually high candidate rate is a legitimate outcome of pure API authorization logic (low Effort/Dependencies) protecting core security machinery (high Impact), not a relaxed filter; all 15 independently passed the Phase-0 three-question gate. All 8 formal ACs covered; TC5/TC6 are risk-beyond-AC boundary checks (no write-to-read hierarchy, extra-scope tolerance) the ACs don't explicitly name.

## Bug-driven special case: TC9 / BK-679

TC9 is the exact outline that discovered defect **BK-623** (Open, Low) during `/sprint-testing` Stage 2. Per the bug-driven golden rule, it was **reused as the permanent regression Test**, not duplicated. It is linked directly to BK-623 (`BK-623 "is tested by" BK-679`) in addition to the standard ATS/ATP/ATR links. **This TC will FAIL when executed until BK-623 ships** — that is intentional and documented in the TC's description, not a data-entry error.

## Every TC verified (all fields, post-creation)

- Parent epic: BK-70 (QA Test Repository) — 15/15 ✓
- Story link: `is tested by` BK-499 via the ATS (BK-668), direction verified via REST `issuelinks` — 15/15 ✓ (Set-first: TCs aggregate through the ATS, not a direct Story link)
- ATP link: `is designed by` BK-669 (Test Design) — 15/15 ✓
- ATR link: `is executed by` BK-670 (Test Execute) — 15/15 ✓
- Status: Candidate (Draft→In Design→READY→In Review→Candidate) — 15/15 ✓
- Priority: native Jira field set explicitly via REST PUT (Highest/Medium/Low per the ROI table above) — 15/15 ✓ (initially missed on create, caught and fixed same session — see Gotchas)
- Description: full template applied (Related Story, Priority/ROI, Prior bugs, Test Design Gherkin, Variables, Implementation Code, Architecture, Available Test IDs, Preconditions, Expected Results) — 15/15 ✓
- Labels: `regression` + `automation-candidate` + `critical` (on the 8 Highest-priority TCs) — 15/15 ✓
- Components: `Bunkai API Tokens` on every TC (inherited from the Story, which itself had no components set until this session) — 15/15 ✓
- Local cache: `.context/PBI/epics/EPIC-BK-1-tenancy-identity/stories/STORY-BK-499-pat-enforce-capability-scopes-on-read-identity-and/test-cases/*.md` — 15/15 ✓

## Handoff to /test-automation

Scope: **ticket-driven** (Medium scope per test-automation's re-scoping table). All 15 TCs are Candidate and ready for automation — pure API authorization logic, no UI. Outlines 3, 4, 7 and 10 are parameterized (Scenario Outline + Examples) covering 4, 4, 2 and 2 routes respectively — implement each as one parameterized ATC, not four separate ones. TC9 should be implemented last (or marked expected-fail) until BK-623 ships, so the suite doesn't carry a permanently-red test without an obvious reason in CI output.

## Gotchas discovered this session (for reuse by future test-documentation runs on this project)

1. **`.agents/jira-required.yaml`'s `test_execute.name` was wrong** (`Test Execution`, should be `Test Execute`) — confirmed via `GET /rest/api/3/issueLinkType` and cross-checked against the canonical boilerplate (which already has the correct name). Fixed locally; not a boilerplate bug, pure local drift. See engram `config/jira-link-types-drift`.
2. **The Story (BK-499) had no `components` set** despite the doctrine requiring it — components are not automatically populated on Story creation in this project. Set explicitly (Bunkai API Tokens) via REST PUT before propagating to the TCs; `acli workitem edit` has no component flag (native field, same blind spot as custom fields).
3. **`acli workitem create --from-json`'s `priority` field was silently never set** in this session's first pass — it was only written as prose inside the Description's "## Priority" section, not as `additionalAttributes.priority`. All 15 TCs came back with `priority: null`. Caught via a Read-back check, fixed via REST PUT (`{fields: {priority: {id: "1"}}}`) using this instance's `GET /rest/api/3/priority` IDs (1=Highest..5=Lowest, no "Critical" value exists — map Critical→Highest). **Future sessions: pass `additionalAttributes.priority: {id: "N"}` on the CREATE payload directly**, don't rely on description prose.
4. `QA Test Artifacts` epic key was `null` in `.agents/project.yaml` (never cached from a prior run) — resolved via JQL search (`BK-515`) and cached.
5. The "Set-first" linking order (ATS → ATP → ATR → TCs) worked cleanly end to end; no orphaned references needed fixing.
