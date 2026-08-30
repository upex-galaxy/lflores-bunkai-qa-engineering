/**
 * KATA Architecture - Capability Gate Integration Tests
 *
 * BK-499: cross-cutting proof of the capability-scope gate itself, sampled
 * against GET /api/v1/activity (an `atc:read`-gated route). Grows across
 * this Story's TC batch — covers TC5/TC6/TC11 (BK-675/676/681) and
 * TC12/TC13 (BK-682/683); TC3/TC4/TC7 (BK-673/674/677) land here later.
 *
 * Project: integration (depends on api-setup)
 */

import { config, test } from '@TestFixture';
import { authenticateAs } from '@utils/auth';

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
});
