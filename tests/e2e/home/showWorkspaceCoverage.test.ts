/**
 * KATA Architecture - Home Workspace Coverage Card E2E Test
 *
 * Regression guard for BK-259's Home "Coverage" card: the headline percentage
 * and the three-way breakdown (executed, awaiting execution, no coverage) of
 * the workspace's acceptance criteria (ACs).
 *
 * The shared QA workspace holds no executed AC today, so the test builds its own
 * three states through the API and compares the UI with the API rollup the card
 * is made from. Everything is measured as a delta against a baseline read just
 * before seeding, so other data in the workspace never changes the verdict.
 *
 * The seed is archived in `afterEach`, not in the test body: Playwright still
 * runs the hook when the test times out or fails, and reports a hook failure
 * next to the test failure instead of replacing it. The workspace is then read
 * again and must equal the baseline (the cleanup is verified at the destination).
 *
 * Project: e2e (depends on ui-setup: authenticated owner session)
 */

import type { ApiFixture } from '@ApiFixture';
import type { WorkspaceCoverage } from '@schemas/workspace.types';

import { QA_WORKSPACE_ID, QA_WORKSPACE_MODULE_ID, QA_WORKSPACE_PROJECT_ID } from '@data/constants';
import { CoverageSeedSteps } from '@steps/CoverageSeedSteps';
import { expect, test } from '@TestFixture';

/**
 * The headline percentage re-derived from the counts by the documented rule,
 * without calling the app's `coveragePercent`: whole percent, half-up, clamped to
 * [1, 99] unless the ratio is exactly 0 or exactly 1, and null when there is
 * nothing to measure. Rule source: `lib/home/coverage.ts` in the app (BK-881).
 * It catches a wiring or rounding slip between the API and the card; it is the
 * same rule, so it cannot catch a mistake in the rule itself.
 */
function expectedPercent(bound: number, total: number): number | null {
  if (total === 0) { return null; }
  if (bound === 0) { return 0; }
  if (bound === total) { return 100; }
  return Math.min(99, Math.max(1, Math.round((bound / total) * 100)));
}

test.describe('BK-259: Home Workspace Coverage Card', { tag: ['@regression'] }, () => {
  // State shared between the test and its `afterEach`. Safe because this suite
  // runs serially (`workers: 1`, `fullyParallel: false`) and the hook resets it.
  // `seedSteps` is created BEFORE anything is seeded and records every id it
  // creates, so the hook can clean up even when the seed never returned.
  let seedSteps: CoverageSeedSteps | undefined;
  let baseline: WorkspaceCoverage | undefined;

  // A read that fails must say so: an error envelope has no counts, and the
  // deltas would turn into NaN and look like a product defect.
  async function readCoverage(api: ApiFixture, when: string): Promise<WorkspaceCoverage> {
    const [response, body] = await api.coverage.getWorkspaceCoverage(QA_WORKSPACE_ID);
    expect(response.status(), `[BK-864] ${when} coverage read`).toBe(200);
    return body;
  }

  test.afterEach(async ({ test: fixture }) => {
    // Take and reset the shared state first, so no path can leak it into another test
    const steps = seedSteps;
    const before = baseline;
    seedSteps = undefined;
    baseline = undefined;
    if (!steps) { return; }

    // Removes whatever was created, even from a seed that failed or timed out midway
    await steps.cleanup();

    // Verify the cleanup at the destination, not by its status code: the
    // workspace must read exactly as it did before the seed. Without a baseline
    // nothing was seeded either (the test reads it before seeding).
    if (!before) { return; }
    const restored = await readCoverage(fixture.api, 'post-cleanup');
    expect(restored.ac_total).toBe(before.ac_total);
    expect(restored.ac_executed).toBe(before.ac_executed);
    expect(restored.ac_not_run).toBe(before.ac_not_run);
    expect(restored.ac_uncovered).toBe(before.ac_uncovered);
  });

  /**
   * ATC: BK-864
   *
   * Precondition (built here, discovered against a baseline): the owner's
   * workspace holds one AC per state: executed, awaiting execution, no coverage.
   * The UI session user and the API token are the same owner, so the seed lands
   * in the workspace the Home screen shows (`/me` reports it as the active one).
   */
  test(
    'BK-864: should show workspace coverage percentage given a mix of executed, awaiting and uncovered ACs',
    async ({ test: fixture }) => {
      // Registered first: from here on `afterEach` can clean up whatever gets created
      const steps = new CoverageSeedSteps(fixture.api);
      seedSteps = steps;

      // Baseline BEFORE seeding: the figures the workspace already carries
      const before = await readCoverage(fixture.api, 'baseline');
      baseline = before;

      await steps.seedAcStates({
        moduleId: QA_WORKSPACE_MODULE_ID,
        projectId: QA_WORKSPACE_PROJECT_ID,
        workspaceId: QA_WORKSPACE_ID,
      });

      // Oracle AFTER seeding: the rollup the card is built from
      const after = await readCoverage(fixture.api, 'post-seed');

      // Precondition check, before the UI step: the seed moved each state by
      // exactly one AC and nothing else. If it did not, this fails here as a
      // broken precondition instead of reading like a product defect below.
      expect(after.ac_total - before.ac_total).toBe(3);
      expect(after.ac_executed - before.ac_executed).toBe(1);
      expect(after.ac_not_run - before.ac_not_run).toBe(1);
      expect(after.ac_uncovered - before.ac_uncovered).toBe(1);

      // ACTION: the QA Lead opens Home - ATC handles the fixed assertions
      // (percentage shown, chips visible, chips sum to the total on the card)
      const card = await fixture.ui.home.showWorkspaceCoverage();

      // The card prints what the rollup says
      expect(card.total).toBe(after.ac_total);
      expect(card.executed).toBe(after.ac_executed);
      expect(card.notRun).toBe(after.ac_not_run);
      expect(card.uncovered).toBe(after.ac_uncovered);
      expect(card.percent).toBe(after.ac_coverage_percent);

      // ...and the percentage is also right by its own rule, not only equal to
      // the number the app computed with the same function
      expect(card.percent).toBe(expectedPercent(after.ac_bound, after.ac_total));
    },
  );
});
