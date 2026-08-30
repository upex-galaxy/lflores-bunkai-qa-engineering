/**
 * KATA Architecture - Capability Gate Integration Tests
 *
 * BK-499: cross-cutting proof of the capability-scope gate itself, sampled
 * against GET /api/v1/activity (an `atc:read`-gated route). Grows across
 * this Story's TC batch — covers TC5/TC6/TC11 (BK-675/676/681), TC12/TC13
 * (BK-682/683), and TC3/TC4/TC7 (BK-673/674/677).
 *
 * Project: integration (depends on api-setup)
 */

import type { CapabilityGateRouteRow } from '@api/CapabilityGateApi';
import type { ApiFixture } from '@ApiFixture';
import { BK264_DEFECT_TRIAGE_PROJECT_ID, BK264_QA_SANDBOX_WORKSPACE_ID, DEFECT_TRIAGE_MODULE_ID } from '@data/constants';
import { config, test } from '@TestFixture';
import { authenticateAs } from '@utils/auth';

/**
 * Precondition builder for TC3/TC4 (BK-673/674): resolves the 4 sampled
 * read-gated routes' real ids under the ALREADY-established BK-264 QA
 * Sandbox fixtures (`@data/constants` — same project/module used by BK-498's
 * own sweep) rather than bootstrapping a disposable project from scratch.
 * `/tests/{id}/runs` needs a real Test, which needs a real product-domain
 * ATC anchored to a real Acceptance Criterion — both generated fresh here
 * (never a fixed id) so this precondition never depends on a single
 * hand-seeded row surviving in staging.
 *
 * Must run under the OWNER session (full atc:write) — the caller narrows to
 * a scoped PAT only after this setup completes.
 *
 * @param api - The ApiFixture instance (OWNER session already authenticated)
 * @returns The 4 resolved rows, ready to hand to a CapabilityGateApi ATC
 */
async function buildSampledReadGatedRoutes(api: ApiFixture): Promise<CapabilityGateRouteRow[]> {
  // Discover a real user-story id under the fixture module, creating one
  // under the OWNER session if none exists yet.
  const [, listBody] = await api.modules.getModuleUserStories(DEFECT_TRIAGE_MODULE_ID);
  let storyId = listBody.user_stories[0]?.id;
  if (!storyId) {
    const [, createBody] = await api.authoringSweep.createUserStory(DEFECT_TRIAGE_MODULE_ID, {
      title: api.data.createTestId('gate-fixture-us'),
    });
    storyId = createBody.user_story.id;
  }

  const [, acBody] = await api.authoringSweep.createAcceptanceCriterion(storyId, {
    title: api.data.createTestId('gate-fixture-ac'),
  });

  const [, atcBody] = await api.authoringSweep.createAtc({
    title: api.data.createTestId('gate-fixture-atc'),
    module_id: DEFECT_TRIAGE_MODULE_ID,
    user_story_id: storyId,
    acceptance_criterion_ids: [acBody.acceptance_criterion.id],
    layer: 'API',
    steps: [{ position: 1, content: 'Verify the capability gate sampling fixture.' }],
  });

  const [, testBody] = await api.authoringSweep.createTest({
    title: api.data.createTestId('gate-fixture-test'),
    atc_ids: [atcBody.atc.id],
    workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID,
  });

  return [
    { route: '/api/v1/activity', path: `/activity?workspace_id=${BK264_QA_SANDBOX_WORKSPACE_ID}` },
    { route: '/api/v1/projects/{id}/traceability', path: `/projects/${BK264_DEFECT_TRIAGE_PROJECT_ID}/traceability?story=${storyId}` },
    { route: '/api/v1/tests/{id}/runs', path: `/tests/${testBody.test.id}/runs` },
    { route: '/api/v1/workspaces/{id}', path: `/workspaces/${BK264_QA_SANDBOX_WORKSPACE_ID}` },
  ];
}

test.describe('BK-499: Capability Gate API', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-675
   *
   * Precondition: fresh login + mint a PAT scoped ONLY `atc:write` + discover
   * any workspace the caller is a member of (ownership irrelevant — /activity
   * is a plain read).
   */
  test(
    'BK-499: should reject given PAT scoped atc:write only on a read-gated route',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['atc:write'] });
      api.setAuthToken(pat.token);

      const [, me] = await api.auth.getCurrentUser();
      test.skip(me.workspaces.length === 0, 'BK-499: test user needs at least one workspace membership');
      const workspaceId = me.workspaces[0].id;

      // ACTION: ATC handles fixed assertion — 403, write does not substitute for read
      await api.capabilityGate.rejectWriteOnlyPatOnReadGatedRoute(workspaceId);
    },
  );

  /**
   * ATC: BK-676
   *
   * Precondition: fresh login + mint a PAT scoped `atc:read` plus an
   * unrelated extra scope (`run:execute`) + discover any workspace.
   */
  test(
    'BK-499: should pass given PAT holds required scope plus an unrelated extra scope',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['atc:read', 'run:execute'] });
      api.setAuthToken(pat.token);

      const [, me] = await api.auth.getCurrentUser();
      test.skip(me.workspaces.length === 0, 'BK-499: test user needs at least one workspace membership');
      const workspaceId = me.workspaces[0].id;

      // ACTION: ATC handles fixed assertions — 200, data returned
      await api.capabilityGate.allowReadPatWithExtraUnrelatedScope(workspaceId);
    },
  );

  /**
   * ATC: BK-681
   *
   * Precondition: fresh login only — no PAT minted, the session cookie IS
   * the precondition + discover any workspace.
   */
  test(
    'BK-499: should serve a capability-gated route to a browser session with no scope check',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      // authenticateSuccessfully() leaves an ambient Bearer PAT set (BK-166
      // coexistence) alongside the session cookie — clear it so this test
      // actually exercises the cookie-only channel, not an incidentally
      // full-scoped Bearer token that would pass for the wrong reason.
      api.clearAuthToken();

      const [, me] = await api.auth.getCurrentUser();
      test.skip(me.workspaces.length === 0, 'BK-499: test user needs at least one workspace membership');
      const workspaceId = me.workspaces[0].id;

      // ACTION: ATC handles fixed assertions — 200, data returned, no scope check applies
      await api.capabilityGate.allowBrowserSessionOnGatedRouteNoScopeCheck(workspaceId);
    },
  );

  /**
   * ATC: BK-682
   *
   * Precondition: fresh login + Generate a fresh workspace via the BK-671
   * bootstrap flow (guarantees ownership — Discover could land on a plain
   * "member" workspace instead) + mint a PAT scoped ONLY `run:execute`,
   * bound to it.
   */
  test(
    'BK-499: should reject given owner role missing the required capability',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      const bootstrapPat = await api.tokens.mintPatWithScopes();
      api.setAuthToken(bootstrapPat.token);
      const [, workspaceBody] = await api.workspace.createWorkspaceWithAnyScope({
        name: api.data.createTestId('Workspace'),
        slug: api.data.createTestId('ws').toLowerCase(),
      });
      const workspaceId = workspaceBody.workspace.id;

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['run:execute'], workspace_id: workspaceId });
      api.setAuthToken(pat.token);

      // ACTION: ATC handles fixed assertion — 403, owner role does not substitute for the missing capability
      await api.capabilityGate.rejectOwnerRoleMissingCapability(workspaceId);
    },
  );

  /**
   * ATC: BK-683
   *
   * Precondition: fresh login as `config.testViewer` — a real, permanently
   * provisioned second identity (BK-264 QA Sandbox), Viewer-role member of a
   * real workspace + discover that workspace + mint a PAT scoped `atc:read`,
   * bound to it.
   */
  test(
    'BK-499: should pass given PAT holds required scope given viewer role',
    async ({ api }) => {
      test.skip(!config.testViewer.email, 'BK-499: config.testViewer not provisioned for this environment');

      // Not config.testUser — must propagate via authenticateAs, not a bare
      // authenticateSuccessfully() call (see tests/utils/auth.ts doc comment).
      await authenticateAs(api, { email: config.testViewer.email, password: config.testViewer.password });

      const [, me] = await api.auth.getCurrentUser();
      test.skip(me.workspaces.length === 0, 'BK-499: config.testViewer needs at least one workspace membership');
      const workspaceId = me.workspaces[0].id;

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['atc:read'], workspace_id: workspaceId });
      api.setAuthToken(pat.token);

      // ACTION: ATC handles fixed assertions — 200, data returned
      await api.capabilityGate.allowViewerRoleWithCapability(workspaceId);
    },
  );

  /**
   * ATC: BK-673
   *
   * Precondition: fresh login (OWNER session) + resolve the 4 sampled
   * read-gated routes' real ids via `buildSampledReadGatedRoutes` + mint a
   * PAT scoped `atc:read`, bound to the BK-264 QA Sandbox workspace.
   */
  test(
    'BK-499: should return 200 with data given PAT scoped atc:read',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      const rows = await buildSampledReadGatedRoutes(api);

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['atc:read'], workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID });
      api.setAuthToken(pat.token);

      // ACTION: ATC handles fixed assertions — 200 on all 4 sampled routes
      await api.capabilityGate.allowReadScopedPatOnGatedRoute(rows);
    },
  );

  /**
   * ATC: BK-674
   *
   * Precondition: fresh login (OWNER session) + resolve the same 4 sampled
   * routes as BK-673 (own chain, per "each test generates its own data") +
   * mint a PAT scoped only `run:execute`, bound to the BK-264 QA Sandbox
   * workspace.
   */
  test(
    'BK-499: should return 403 given PAT missing atc:read',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      const rows = await buildSampledReadGatedRoutes(api);

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['run:execute'], workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID });
      api.setAuthToken(pat.token);

      // ACTION: ATC handles fixed assertions — 403 on all 4 sampled routes, naming atc:read
      await api.capabilityGate.rejectPatMissingReadScopeOnGatedRoute(rows);
    },
  );

  /**
   * ATC: BK-677
   *
   * Precondition: fresh login + mint a PAT scoped only `run:execute`
   * (irrelevant to this bucket) + discover any workspace the caller is a
   * member of.
   */
  test(
    'BK-499: should succeed for any authenticated PAT regardless of scope given identity or notification route',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['run:execute'] });
      api.setAuthToken(pat.token);

      const [, me] = await api.auth.getCurrentUser();
      test.skip(me.workspaces.length === 0, 'BK-499: test user needs at least one workspace membership');
      const workspaceId = me.workspaces[0].id;

      const rows: CapabilityGateRouteRow[] = [
        { route: 'GET /api/v1/me', path: '/me' },
        { route: 'GET /api/v1/workspaces/{id}/notifications', path: `/workspaces/${workspaceId}/notifications` },
      ];

      // ACTION: ATC handles fixed assertions — 200/201 on both sampled routes, no 403
      await api.capabilityGate.allowAnyAuthenticatedPatOnIdentityRoute(rows);
    },
  );
});
