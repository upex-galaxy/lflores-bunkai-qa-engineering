/**
 * KATA Architecture - Authoring Sweep Integration Tests (Reject leg)
 *
 * BK-498 — capability-scope enforcement on the authoring domain, cross-family
 * sweep (TC11): a PAT scoped exactly `atc:read` is rejected (403) on a
 * minimal-valid write attempt against all 5 authoring-domain resource
 * families (User Stories, Acceptance Criteria, Environments, Milestones,
 * Imports) — "only the wiring varies per family" (automation-plan.md §2).
 *
 * This file never successfully calls POST /imports (every row 403s before
 * any side effect), so it never acquires the project's "at most one active
 * import" lock and is safe to run in its own file/worker alongside
 * enforceAuthoringWriteReadSweep.test.ts / completeImportLifecycleDualScope.test.ts.
 *
 * Project: integration (depends on api-setup)
 */

import { BK264_DEFECT_TRIAGE_PROJECT_ID, BK264_QA_SANDBOX_WORKSPACE_ID, DEFECT_TRIAGE_MODULE_ID } from '@data/constants';
import { config, test } from '@TestFixture';

test.describe('BK-498: Authoring Sweep — reject writes across families', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-559
   *
   * Precondition: fresh login (OWNER session); discover-or-create a real
   * user-story id under the module (needed as the Acceptance Criteria row's
   * parent) BEFORE narrowing to the under-scoped PAT; mint an `atc:read`-only
   * PAT bound to the QA sandbox workspace.
   */
  test(
    'BK-498: should reject writes across all authoring families given a PAT scoped exactly atc:read',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      // Precondition (not a BK-559 assertion): discover a real user-story id
      // under the fixture module, creating one under the OWNER session if
      // none exists yet — the Acceptance Criteria row needs a real parent.
      const [, listBody] = await api.modules.getModuleUserStories(DEFECT_TRIAGE_MODULE_ID);
      let userStoryId = listBody.user_stories[0]?.id;
      if (!userStoryId) {
        const [, createBody] = await api.authoringSweep.createUserStory(DEFECT_TRIAGE_MODULE_ID, {
          title: api.data.createTestId('sweep-fixture-us'),
        });
        userStoryId = createBody.user_story.id;
      }

      const pat = await api.tokens.mintPatWithScopes({
        scopes: ['atc:read'],
        workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID,
      });
      api.authoringSweep.setAuthToken(pat.token);

      // ACTION: attempt a minimal-valid write on all 5 families — ATC
      // handles fixed assertions (403 on every row, Imports row included)
      await api.authoringSweep.rejectWritesAcrossFamilies(
        DEFECT_TRIAGE_MODULE_ID,
        BK264_DEFECT_TRIAGE_PROJECT_ID,
        userStoryId,
      );
    },
  );
});
