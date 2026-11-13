/**
 * KATA Architecture - Authoring Sweep Integration Tests (Accept leg + Imports lifecycle)
 *
 * BK-498 — capability-scope enforcement on the authoring domain, cross-family
 * sweep (TC12/TC13/TC14, chained) + the Imports positive control (TC15).
 *
 * Grouped in ONE file, ONE `test.describe.serial(...)` block, in this exact
 * order, as 2 separate `test()` blocks — NOT 4 unordered files/tests. Reason:
 * `POST /imports` enforces "at most one active import per project" (409).
 * TC12 (`acceptWritesAcrossFamilies`) and TC15
 * (`completeImportLifecycleDualScope`) both call it against the SAME
 * `QA_WORKSPACE_PROJECT_ID`. `test.describe.serial` guarantees
 * Playwright runs both tests in one worker, sequentially — and TC12's own
 * ATC drains its Imports row to a terminal state
 * (`AuthoringSweepApi.pollImportJobUntilTerminal`) before returning — so
 * TC15's own `POST /imports` never collides with a still-active job from
 * TC12. (This repo's `playwright.config.ts` already runs `workers: 1` /
 * `fullyParallel: false` globally, which independently prevents the race —
 * the explicit `.serial` here documents the dependency so it survives a
 * future config change.)
 *
 * TC12→TC13/TC14 is an ATP-documented data dependency ("these created rows
 * become TC13's read fixtures"), not accidental shared state — see
 * automation-plan.md §5, Scenario 12-14, for the full chaining rationale.
 *
 * Project: integration (depends on api-setup)
 */

import { QA_WORKSPACE_ID, QA_WORKSPACE_MODULE_ID, QA_WORKSPACE_PROJECT_ID } from '@data/constants';
import { config, expect, test } from '@TestFixture';

// BK-1170: `POST /imports` returns 409 `jira_not_connected` (before any job
// exists) when the workspace has no Jira connection of its own. That is an
// environment precondition, not a BK-498 behavior: fail fast naming the fix
// instead of an opaque status assertion deep inside the ATC.
const QA_WORKSPACE_JIRA_NOT_CONNECTED
  = 'Staging precondition: QA workspace "luisflores" (QA_WORKSPACE_ID) has no Jira connection (BK-1170). '
    + 'An owner/admin must connect it in Settings > Jira before the Imports family can be exercised.';

test.describe.serial('BK-498: authoring write/read sweep + import lifecycle', { tag: ['@critical'] }, () => {
  /**
   * ATCs: BK-561 -> BK-563 -> BK-566 (chained in one test, same test-level
   * artifact — see automation-plan.md §5, Scenario 12-14).
   *
   * Precondition: fresh login (OWNER session); discover-or-create a real
   * user-story id under the module BEFORE narrowing to any scoped PAT; mint
   * TWO PATs — `atc:write` (used for BK-561 and, again, for BK-566) and a
   * SEPARATE `atc:read` (used for BK-563).
   */
  test(
    'BK-498: should accept writes and reads across all authoring families given correctly-scoped PATs, and reject reads for a write-only PAT',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      api.workspace.clearAuthToken(); // cookie-only OWNER session: the default Bearer is not workspace-bound
      const [jiraConnectionResponse, jiraConnection] = await api.workspace.getWorkspaceJiraConnection(QA_WORKSPACE_ID);
      expect(jiraConnectionResponse.ok(), `GET jira-connection returned ${jiraConnectionResponse.status()}: ${jiraConnectionResponse.ok() ? '' : await jiraConnectionResponse.text()}`).toBe(true);
      expect(jiraConnection.jira_connection.connected, QA_WORKSPACE_JIRA_NOT_CONNECTED).toBe(true);

      // Precondition (not a BK-561 assertion): discover a real user-story id
      // under the fixture module, creating one under the OWNER session if
      // none exists yet — the Acceptance Criteria row needs a real parent.
      const [, listBody] = await api.modules.getModuleUserStories(QA_WORKSPACE_MODULE_ID);
      let userStoryId = listBody.user_stories[0]?.id;
      if (!userStoryId) {
        const [, createBody] = await api.authoringSweep.createUserStory(QA_WORKSPACE_MODULE_ID, {
          title: api.data.createTestId('sweep-fixture-us'),
        });
        userStoryId = createBody.user_story.id;
      }

      const writePat = await api.tokens.mintPatWithScopes({
        scopes: ['atc:write'],
        workspace_id: QA_WORKSPACE_ID,
      });
      const readPat = await api.tokens.mintPatWithScopes({
        scopes: ['atc:read'],
        workspace_id: QA_WORKSPACE_ID,
      });

      // ACTION 1 (BK-561): write across all 5 families with the write PAT —
      // ATC handles fixed assertions (2xx + side-effect id per row) and
      // drains the Imports row before returning.
      api.authoringSweep.setAuthToken(writePat.token);
      const createdRows = await api.authoringSweep.acceptWritesAcrossFamilies(
        QA_WORKSPACE_MODULE_ID,
        QA_WORKSPACE_PROJECT_ID,
        userStoryId,
      );

      // ACTION 2 (BK-563): read the same 5 rows back with a SEPARATE read
      // PAT — ATC handles fixed assertions (200 per row).
      api.authoringSweep.setAuthToken(readPat.token);
      await api.authoringSweep.acceptReadsAcrossFamilies(createdRows);

      // ACTION 3 (BK-566): read the same 5 rows again, this time with the
      // write-only PAT (no atc:read) — ATC handles fixed assertions (403 per
      // row, Imports row included; positive control is TC15 below).
      api.authoringSweep.setAuthToken(writePat.token);
      await api.authoringSweep.rejectReadsAcrossFamilies(createdRows);
    },
  );

  /**
   * ATC: BK-568
   *
   * Precondition: fresh login (OWNER session); mint a dual-scope PAT
   * (`atc:write` + `atc:read`) bound to the QA workspace. Runs AFTER
   * the test above in the same serial group — its own Imports row is
   * already terminal by the time this test's `POST /imports` fires.
   */
  test(
    'BK-498: should complete a full import lifecycle successfully given a PAT scoped both atc:write and atc:read',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      api.workspace.clearAuthToken(); // cookie-only OWNER session: the default Bearer is not workspace-bound
      const [jiraConnectionResponse, jiraConnection] = await api.workspace.getWorkspaceJiraConnection(QA_WORKSPACE_ID);
      expect(jiraConnectionResponse.ok(), `GET jira-connection returned ${jiraConnectionResponse.status()}: ${jiraConnectionResponse.ok() ? '' : await jiraConnectionResponse.text()}`).toBe(true);
      expect(jiraConnection.jira_connection.connected, QA_WORKSPACE_JIRA_NOT_CONNECTED).toBe(true);
      const pat = await api.tokens.mintPatWithScopes({
        scopes: ['atc:write', 'atc:read'],
        workspace_id: QA_WORKSPACE_ID,
      });
      api.authoringSweep.setAuthToken(pat.token);

      // ACTION: enqueue then poll an import job to completion — ATC handles
      // fixed assertions (202 + job id on enqueue, 200 + `completed` on the
      // final poll)
      await api.authoringSweep.completeImportLifecycleDualScope(QA_WORKSPACE_PROJECT_ID);
    },
  );
});
