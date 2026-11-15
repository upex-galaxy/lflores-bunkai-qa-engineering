/**
 * KATA Architecture - Layer 3.5: Coverage Seed Steps
 *
 * Reusable precondition chain for the BK-259 Home coverage suite: it builds the
 * three acceptance-criterion (AC) states the Home "Coverage" card breaks the
 * workspace into, on top of whatever the shared workspace already holds.
 *
 * State rule (migration 0109, bunkai_report_workspace_coverage):
 * - executed:  an ATC is bound and its most recent run row is passed/failed
 * - awaiting:  an ATC is bound but it never ran (or its latest row is pending)
 * - uncovered: no ATC bound at all
 *
 * Steps are NOT ATCs: no `@atc`, no fixture registration. The test instantiates
 * the class directly with the ApiFixture it already has. Every call checks that
 * the server accepted it, so a broken precondition fails as a precondition and
 * never as a false product defect.
 *
 * Seeding is additive and there is ONE cleanup path, `cleanup()`. The instance
 * records the story id and the run:execute PAT id the moment each exists, so a
 * caller that runs `cleanup()` from an `afterEach` removes whatever was created
 * even when the seed never returned (a failure or a timeout midway). Archiving
 * the story archives its ACs and ATCs in one transaction, so the rollup returns
 * to its baseline. The Test and the Run created for the executed AC stay behind on
 * every run: the API has no delete or archive for either (`/tests/{id}` and
 * `/runs/{id}` only expose GET, checked in `api/openapi.json`). Each run
 * therefore adds one Test and one Run to the QA workspace; this is a known,
 * accepted residue recorded in the BK-864 plan and session progress.
 */

import type { ApiFixture } from '@ApiFixture';
import type { APIResponse } from '@playwright/test';

import { expect } from '@playwright/test';
import { TestContext } from '@TestContext';

// ============================================
// Types
// ============================================

/**
 * Where to seed: a module, the project that owns it (the ATCs must live in the
 * AC's project) and the workspace (a Bearer caller must name it to create a Test).
 */
export interface CoverageSeedTarget {
  moduleId: string
  projectId: string
  workspaceId: string
}

/** What `seedAcStates` created, one AC per state. */
export interface CoverageSeed {
  userStoryId: string
  executedAcId: string
  awaitingAcId: string
  uncoveredAcId: string
}

// ============================================
// Steps
// ============================================

export class CoverageSeedSteps extends TestContext {
  private readonly api: ApiFixture;

  /** Story created by `seedAcStates`, kept until `cleanup()` archives it. */
  private userStoryId: string | undefined;

  /** Id of a minted run:execute PAT whose revoke has not been confirmed yet. */
  private livePatId: string | undefined;

  /**
   * Set by `cleanup()`. Playwright cannot cancel a test body that timed out, so
   * the seed may still be awaiting a call while the `afterEach` hook runs
   * `cleanup()`. Once closed, the seed creates nothing more, and anything a call
   * that was already in flight creates is removed on the spot.
   */
  private closed = false;

  // Takes the test's own ApiFixture instead of `TestContextOptions`: the PAT swap
  // below must see and restore the SAME ambient token the test's calls use.
  constructor(api: ApiFixture) {
    super();
    this.api = api;
  }

  /**
   * Seed one user story with three ACs, one per coverage state.
   *
   * Chain: environment (discovered) -> story -> 3 ACs -> 2 ATCs (one per bound
   * AC) -> a Test chaining the first ATC -> a finished passing run of that Test.
   * The second ATC gets no run, and the third AC gets no ATC.
   *
   * @param target - Module and owning project to seed into
   * @returns The ids needed to assert on, and later to clean up
   */
  async seedAcStates(target: CoverageSeedTarget): Promise<CoverageSeed> {
    this.assertOpen('the seed');
    const tag = this.data.createTestId('cov');
    const { authoringSweep } = this.api;

    // Discover: reuse an environment the project already has instead of minting one.
    const [envResponse, envBody] = await authoringSweep.getEnvironments(target.projectId);
    this.expectAccepted({ response: envResponse, what: 'list environments' });
    const environment = envBody.environments[0];
    if (!environment) {
      throw new Error(`[CoverageSeedSteps] Project ${target.projectId} has no environment to run against. Create one first.`);
    }

    const [storyResponse, storyBody] = await authoringSweep.createUserStory(target.moduleId, { title: `BK-864 coverage seed ${tag}` });
    this.expectAccepted({ response: storyResponse, what: 'create user story' });
    const userStoryId = storyBody.user_story.id;

    // `cleanup()` ran while this create was in flight and never saw the story:
    // archive it here, then stop the seed.
    if (this.closed) {
      await authoringSweep.deleteUserStory(userStoryId).catch(() => undefined);
      this.assertOpen('anything more');
    }

    // Recorded now, not on return: if anything below fails or times out, the
    // caller never receives the seed, but `cleanup()` can still archive this story.
    this.userStoryId = userStoryId;

    return this.seedStates({ target, userStoryId, tag, environmentName: environment.name });
  }

  /**
   * Remove everything this instance created that is still alive: revoke the
   * run:execute PAT if its revoke was never confirmed, then archive the story
   * (which archives its ACs and ATCs in one transaction and drops them from the
   * workspace figures). Safe to call when nothing was created.
   *
   * Both removals are always attempted and every failure is reported together,
   * so a half-done cleanup is never silent. The messages this class writes name
   * ids only, never a token value. KNOWN EXCEPTION: when a request itself fails
   * (a network error or a timeout), Playwright's own error text carries a call log
   * with the request headers, `Authorization` included, and it is passed on as is.
   * Accepted for a 1-day, workspace-bound, revoked-right-after PAT (see the BK-864
   * automation plan, section 6).
   */
  async cleanup(): Promise<void> {
    // Closed first: from here on the seed, if it is still running, creates nothing
    this.closed = true;

    const storyId = this.userStoryId;
    const patId = this.livePatId;
    this.userStoryId = undefined;
    this.livePatId = undefined;

    const failures: string[] = [];

    if (patId && !(await this.revokePat(patId))) {
      failures.push(`revoking the run:execute PAT ${patId} was not confirmed (204): it stays valid for 1 day, revoke it from the token settings`);
    }

    if (storyId) {
      try {
        const [response] = await this.api.authoringSweep.deleteUserStory(storyId);
        if (!response.ok()) { failures.push(`archiving the seeded user story ${storyId} returned HTTP ${response.status()}`); }
      }
      catch (error) {
        failures.push(`archiving the seeded user story ${storyId} threw: ${String(error)}`);
      }
    }

    // Soft: the failure is recorded and fails the test, but the caller's hook goes
    // on, so it can still read the rollup and show what was actually left behind.
    expect.soft(failures, '[CoverageSeedSteps] cleanup left things behind').toEqual([]);
  }

  /** Build the three AC states inside an already-created story. */
  private async seedStates(args: {
    target: CoverageSeedTarget
    userStoryId: string
    tag: string
    environmentName: string
  }): Promise<CoverageSeed> {
    const { target, userStoryId, tag, environmentName } = args;
    const { authoringSweep } = this.api;

    const acIds: string[] = [];
    for (const state of ['executed', 'awaiting', 'uncovered']) {
      this.assertOpen(`the ${state} acceptance criterion`);
      const [acResponse, acBody] = await authoringSweep.createAcceptanceCriterion(userStoryId, { title: `AC ${state} ${tag}` });
      this.expectAccepted({ response: acResponse, what: `create ${state} acceptance criterion` });
      acIds.push(acBody.acceptance_criterion.id);
    }
    const [executedAcId, awaitingAcId, uncoveredAcId] = acIds as [string, string, string];

    const atcIds: string[] = [];
    for (const [state, acId] of [['executed', executedAcId], ['awaiting', awaitingAcId]] as const) {
      this.assertOpen(`the ${state} ATC`);
      const [atcResponse, atcBody] = await authoringSweep.createAtc({
        title: `ATC ${state} ${tag}`,
        module_id: target.moduleId,
        user_story_id: userStoryId,
        acceptance_criterion_ids: [acId],
        layer: 'API',
        steps: [{ position: 1, content: 'Seeded by BK-864 to fix the AC in a known coverage state' }],
      });
      this.expectAccepted({ response: atcResponse, what: `create ${state} ATC` });
      atcIds.push(atcBody.atc.id);
    }
    const [executedAtcId] = atcIds as [string, string];

    // Only the executed AC's ATC is chained into a Test and run.
    this.assertOpen('the test');
    const [testResponse, testBody] = await authoringSweep.createTest({
      title: `Test executed ${tag}`,
      atc_ids: [executedAtcId],
      workspace_id: target.workspaceId,
    });
    this.expectAccepted({ response: testResponse, what: 'create test' });

    await this.submitPassingRun({ testId: testBody.test.id, environmentName, workspaceId: target.workspaceId });

    return { userStoryId, executedAcId, awaitingAcId, uncoveredAcId };
  }

  /**
   * Submit one finished, passing run under a PAT minted for this purpose.
   *
   * `POST /runs/submissions` refuses the cached identity token: it is not bound
   * to a workspace ("token_not_workspace_scoped"), and the route reads the
   * workspace from the token. So this mints a `run:execute` PAT bound to the
   * workspace (token issuance is session-only, which the e2e `request` context
   * carries from the UI login), uses it for the one call, and revokes it.
   * Revoking is session-only too, so the ambient Bearer is suspended around it.
   */
  private async submitPassingRun(args: { testId: string, environmentName: string, workspaceId: string }): Promise<void> {
    const { tokens, runs } = this.api;

    this.assertOpen('the run:execute PAT');
    const pat = await tokens.mintPatWithScopes({
      scopes: ['run:execute'],
      workspace_id: args.workspaceId,
      expires_in_days: 1,
    });

    // `cleanup()` ran while the mint was in flight and never saw this PAT:
    // revoke it here, then stop the seed.
    if (this.closed) {
      await this.revokePat(pat.id);
      this.assertOpen('the run');
    }

    // Recorded before anything can fail, so `cleanup()` can still revoke it
    this.livePatId = pat.id;
    expect(pat.token, '[CoverageSeedSteps] mint run:execute PAT returned no token (token issuance needs the session cookie)').toBeTruthy();

    // Keep the run's own failure apart from the revoke's: the revoke always runs,
    // and neither outcome may hide the other.
    let submitFailure: unknown;
    const savedRunsToken = runs.authToken;
    runs.setAuthToken(pat.token);
    try {
      const [response, body] = await runs.submitRun({
        test_id: args.testId,
        environment: args.environmentName,
        verdict: 'passed',
        duration_seconds: 1,
        steps: [{ position: 1, result: 'pass' }],
      });
      this.expectAccepted({ response, what: 'submit passing run', body });
    }
    catch (error) {
      submitFailure = error;
    }
    finally {
      if (savedRunsToken) { runs.setAuthToken(savedRunsToken); }
      else { runs.clearAuthToken(); }
    }

    const revoked = await this.revokePat(pat.id);
    // Forgotten only once the server confirmed it; otherwise `cleanup()` retries
    if (revoked) { this.livePatId = undefined; }

    if (submitFailure) { throw submitFailure; }
    // Names the PAT by id only, never by value (see the known exception in `cleanup()`).
    // Left alive it stays valid until it expires (1 day).
    expect(revoked, `[CoverageSeedSteps] revoking the run:execute PAT ${pat.id} did not return 204: it stays valid for 1 day, revoke it from the token settings`).toBe(true);
  }

  /**
   * Revoke a PAT and report whether the server confirmed it (204).
   *
   * Revoking is session-only ("PATs cannot revoke tokens"), so the ambient
   * Bearer is suspended for the call and always restored. Never throws: the
   * caller decides what an unconfirmed revoke means.
   */
  private async revokePat(patId: string): Promise<boolean> {
    const { tokens } = this.api;
    const savedToken = tokens.authToken;
    tokens.clearAuthToken();
    try {
      const [response] = await tokens.revokeToken(patId);
      // 404 = the token is already gone (a retry after a revoke whose answer was
      // lost), which is the state we wanted, so it counts as confirmed.
      return response.status() === 204 || response.status() === 404;
    }
    catch {
      return false;
    }
    finally {
      if (savedToken) { tokens.setAuthToken(savedToken); }
    }
  }

  /** Throw once `cleanup()` has run: the test is over, so nothing more may be created. */
  private assertOpen(next: string): void {
    if (this.closed) {
      throw new Error(`[CoverageSeedSteps] cleanup already ran (the test failed or timed out): not creating ${next}`);
    }
  }

  /** Fail the precondition loudly, naming the step, when the server did not accept it. */
  private expectAccepted(args: { response: APIResponse, what: string, body?: unknown }): void {
    const { response, what, body } = args;
    const detail = body === undefined ? '' : `: ${JSON.stringify(body).slice(0, 300)}`;
    expect(response.ok(), `[CoverageSeedSteps] ${what} failed with HTTP ${response.status()}${detail}`).toBe(true);
  }
}
