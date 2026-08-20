/**
 * KATA Architecture - Workspace Admin Capability Scope Integration Tests
 *
 * Non-regression guards for BK-497's PAT scope + workspace-binding enforcement
 * on workspace-admin actions: a `workspace:admin`-scoped PAT bound to the
 * target workspace succeeds (BK-550); the identical scope bound to a
 * DIFFERENT workspace is rejected (BK-551).
 *
 * Project: integration (depends on api-setup)
 */

import { WORKSPACE_NOT_MEMBER_ID } from '@data/constants';
import { config, test } from '@TestFixture';
import { getOwnedWorkspace } from '@utils/workspace';

test.describe('BK-497: Workspace Admin Capability Scope API', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-550
   *
   * Precondition: fresh login + discover a workspace the caller OWNS (PATCH
   * /workspaces/{id} is owner-only per the OpenAPI spec — `active_workspace_id`
   * is not guaranteed to be an owned workspace, it can be a plain "member"
   * one, which the real endpoint 403s on regardless of PAT scope) + mint a
   * `workspace:admin`-scoped PAT bound to it, set as the ambient Bearer token.
   */
  test(
    'BK-497: should allow a workspace-admin action when the PAT is correctly scoped and bound to the target workspace',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      const [, me] = await api.auth.getCurrentUser();
      const currentWorkspace = getOwnedWorkspace(me);
      test.skip(!currentWorkspace, 'BK-497: test user needs to own at least one workspace');
      if (!currentWorkspace) { return; }
      const workspaceId = currentWorkspace.id;

      const pat = await api.tokens.mintPatWithScopes({
        scopes: ['workspace:admin'],
        workspace_id: workspaceId,
      });
      api.workspace.setAuthToken(pat.token);

      // ACTION: no-op-equivalent update (name set to its own current value, avoids
      // polluting the fixture workspace's display name) — ATC handles fixed assertions
      // (200, workspace reflects the sent payload)
      await api.workspace.allowWorkspaceAdminActionWithBoundPat({
        workspaceId,
        body: { name: currentWorkspace?.name ?? api.data.createTestId('ws') },
      });
    },
  );

  /**
   * ATC: BK-551
   *
   * Precondition: fresh login + discover a workspace the caller OWNS (A) —
   * same owner-only rationale as BK-550 — + mint a `workspace:admin`-scoped
   * PAT bound to workspace A + a second, real workspace (B) the caller is
   * not a member of (`WORKSPACE_NOT_MEMBER_ID`).
   */
  test(
    'BK-497: should reject a workspace-admin action when the PAT is bound to a different workspace',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      const [, me] = await api.auth.getCurrentUser();
      const ownedWorkspace = getOwnedWorkspace(me);
      test.skip(!ownedWorkspace, 'BK-497: test user needs to own at least one workspace');
      if (!ownedWorkspace) { return; }
      const workspaceAId = ownedWorkspace.id;

      const pat = await api.tokens.mintPatWithScopes({
        scopes: ['workspace:admin'],
        workspace_id: workspaceAId,
      });
      api.workspace.setAuthToken(pat.token);

      // ACTION: attempt to PATCH workspace B (NOT the PAT's bound workspace A) —
      // ATC handles fixed assertions (403, verbatim wrong-workspace message)
      await api.workspace.rejectCrossWorkspaceAdminPat({
        workspaceId: WORKSPACE_NOT_MEMBER_ID,
        body: { name: api.data.createTestId('ws') },
      });
    },
  );
});
