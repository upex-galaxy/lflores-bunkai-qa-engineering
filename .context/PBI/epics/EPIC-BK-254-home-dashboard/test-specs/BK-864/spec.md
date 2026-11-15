# BK-864: Home coverage card shows the percentage and the three-way breakdown

| Field | Value |
|-------|-------|
| **Priority** | High (TC priority) |
| **Phase** | Standalone (its Page and seeding Steps are reused by BK-879, BK-880, BK-1915) |
| **Items** | 1 TC |
| **Dependencies** | None |
| **Requires** | Cached `owner` identity (`api-setup` + `ui-setup`), reserved fixture workspace `QA_WORKSPACE_ID` (project `QA_WORKSPACE_PROJECT_ID`, module `QA_WORKSPACE_MODULE_ID`) |
| **Source** | Story: BK-259 (TMS-Home, Show workspace test coverage summary), TC1 |

## Summary

The Home screen carries a "Coverage" card (`home-coverage`). Its headline is the share of the
workspace's acceptance criteria (ACs) that have at least one ATC bound. Next to it, three chips split
every AC into exactly one state: executed, awaiting execution, no coverage. The chips must always
add up to the total ACs, so a bound-but-unexecuted AC never reads as "verified".

This is a regression guard for an already-signed manual result (ATR BK-878: TC1 PASSED).

## Preconditions

- A workspace whose ACs are in the three states. The shared staging workspace cannot be assumed to
  have them, so the test BUILDS them (Generate) and compares against a baseline read before seeding.
- State rule (migration 0109, `bunkai_report_workspace_coverage`):
  - no ATC bound to the AC -> `uncovered`
  - an ATC is bound, but its most recent run row is not `passed`/`failed` (or it never ran) -> `not_run`
  - every bound ATC's most recent run row is `passed`/`failed` -> `executed`
- The Home card reads the same rollup the API returns (`GET /workspaces/{id}/coverage`), so the API
  body is the oracle for the UI.

## Test Cases

### BK-864: should show workspace coverage percentage given a mix of executed, awaiting and uncovered ACs

**Preconditions**: workspace with ACs in all three states (seeded by the test on top of whatever it already holds).
**Action**: the QA Lead (owner) opens the Home screen.
**Expected Output**:
- The coverage percentage is shown (not the em dash).
- The three chips (executed, awaiting execution, no coverage) sum to the total ACs stated on the card.
- Each chip moved by exactly the seeded amount versus the baseline (+1 each), and the percentage matches the API rollup.

```gherkin
@regression @e2e @BK-259
Scenario: BK-864 - should show workspace coverage percentage given a mix of executed, awaiting and uncovered ACs
  Given a workspace with one executed AC, one AC awaiting execution and one AC with no test case bound
  When the QA Lead opens the Home screen
  Then the overall coverage percentage is shown
  And the three breakdown chips sum to the total acceptance criteria
```

## Out of this TC

- Rounding at the extremes (0%/100%, half-up, clamp): BK-879, BK-880, BK-1915.
- No prior-period delta is shown (departure D24): not asserted here, covered by the manual AC2 result.
- Error state of the card (BK-871): deferred, no safe fault injection.
