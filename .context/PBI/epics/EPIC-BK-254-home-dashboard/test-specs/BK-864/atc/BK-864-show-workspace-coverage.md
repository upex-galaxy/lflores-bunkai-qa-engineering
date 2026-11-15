# ATC Spec: BK-864 — showWorkspaceCoverage

> Ticket: BK-864 (Story BK-259, TC1)
> Component: HomePage (tests/components/ui/HomePage.ts) — NEW component
> Type: UI — Happy path (State Transition inputs: three AC states coexisting)

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| showWorkspaceCoverage | Prove the Home card prints the percentage and a breakdown that adds up to the total | Authenticated owner, workspace holding executed, awaiting and uncovered ACs | Percentage shown; chips sum to total ACs |

## 2. ATC Contract

```typescript
/**
 * ATC: Open the Home screen and read the Coverage card.
 * Fixed assertions:
 *  - the card and the percentage are visible and the percentage is not the em dash
 *  - the three chips are visible
 *  - executed + awaiting + no coverage equals the total ACs stated in the card sentence
 * Returns what the card shows so the test can compare it with the API.
 */
@atc('BK-864')
async showWorkspaceCoverage(): Promise<CoverageCardReading> { /* ... */ }

interface CoverageCardReading {
  percent: number
  executed: number
  notRun: number
  uncovered: number
  total: number
}
```

## 3. UI Details

| Aspect | Value |
|---|---|
| Route | `/home` |
| Card | `[data-testid="home-coverage"]` |
| Percentage | `[data-testid="home-coverage-percent"]` (text `NN%`, or `—` when there are no ACs) |
| Chips | `home-coverage-executed`, `home-coverage-not-run`, `home-coverage-uncovered` (count is the first span, label is the rest) |
| Total | the sentence `of N acceptance criteria across this workspace ...` inside the card (no testid) |
| Wait | web-first `expect(locator).toBeVisible()`; the card first renders a skeleton (`home-coverage-skeleton`) |

## 4. Assertions Split

### Fixed (inside ATC)
- `home-coverage-percent` visible and matches `/^\d+%$/`
- the three chips visible
- `executed + notRun + uncovered === total` (total parsed from the card sentence)

### Test-level (in test file)
- Baseline read via `CoverageApi.getWorkspaceCoverage` BEFORE seeding, rollup read AFTER seeding.
- Each chip equals the AFTER rollup (`ac_executed`, `ac_not_run`, `ac_uncovered`) and `total` equals `ac_total`.
- Each chip moved by exactly +1 versus the baseline; `ac_total` moved by +3.
- `percent` equals `ac_coverage_percent` of the AFTER rollup.

## 5. Technique-derivation check

| Source | Technique | ATCs produced |
|---|---|---|
| AC1 happy path with mixed states | EP (executed / awaiting / uncovered are three partitions) | 1 ATC, all three partitions seeded in the same flow |
| Risk: bound-but-unexecuted read as verified | Invariant (chips sum to total) | asserted inside the same ATC |
| Rounding and extremes | BVA | NOT here: BK-879, BK-880, BK-1915 |

Floor vs ceiling: AC1 is covered; the chips-sum invariant is the risk beyond the AC.

## 6. Data Context

| Precondition | Pattern | Source | Cleanup |
|---|---|---|---|
| 3 ACs in the three states | Generate | API via `CoverageSeedSteps.seedAcStates` into `QA_WORKSPACE_MODULE_ID` | `CoverageSeedSteps.cleanup()` from `afterEach`: archives the story (`DELETE /user-stories/{id}`), revokes the minted PAT, then the rollup is re-read and must equal the baseline. The one Test and one Run per run are accepted residue (no delete endpoint) |
| Baseline numbers | Discover | `CoverageApi.getWorkspaceCoverage(QA_WORKSPACE_ID)` | none, read-only |

## 7. Checklist

- [x] `verb{Resource}{Scenario}` naming
- [x] Locators inline in the ATC (extract only at 2+ uses)
- [x] Max 2 positional params (0)
- [x] Fixed vs test-level split
- [x] Not duplicating an ATC: no `BK-864` in `kata-manifest.json`
