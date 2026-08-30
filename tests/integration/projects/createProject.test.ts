/**
 * KATA Architecture - Project Creation Integration Tests
 *
 * BK-499 TC14/TC15 (BK-684/BK-685): AC8's capability-scope gate on
 * `POST /workspaces/{id}/projects` — `atc:write` + member-role floor on the
 * positive path, and the gate-before-membership ordering on the negative
 * path (the error names the missing capability, never "not a member").
 *
 * Project: integration (depends on api-setup)
 */

import { WORKSPACE_NOT_MEMBER_ID } from '@data/constants';
import { config, test } from '@TestFixture';

test.describe('BK-499: Project creation capability gate', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-684
   *
   * Precondition: fresh login + Generate a fresh workspace via the BK-671
   * bootstrap flow (owner counts as member, satisfying the role floor) +
   * mint a PAT scoped `atc:write`, bound to it.
   */
  test(
    'BK-499: should create a project given a correctly-scoped, member-role PAT',
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

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['atc:write'], workspace_id: workspaceId });
      api.setAuthToken(pat.token);

      // ACTION: ATC handles fixed assertions — 201, project reflects the sent name
      await api.projects.createProjectSuccessfully({
        workspaceId,
        body: { name: api.data.createTestId('Project') },
      });
    },
  );

  /**
   * ATC: BK-685
   *
   * Precondition: fresh login + mint an UNBOUND PAT scoped only `atc:read`
   * (no `workspace_id`) — binding a PAT to `WORKSPACE_NOT_MEMBER_ID` at
   * mint time is itself rejected (403), since issuance requires the caller
   * already be a member of the workspace being bound. An unbound token
   * works against any workspace path (same posture BK-675/676/681 rely on),
   * so it reaches the gate check against the shared `WORKSPACE_NOT_MEMBER_ID`
   * fixture (real workspace, caller has no membership row — same fixture
   * BK-251/BK-551 already established).
   */
  test(
    'BK-499: should reject project creation with 403 naming the capability given a PAT missing atc:write on a non-member workspace',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['atc:read'] });
      api.setAuthToken(pat.token);

      // ACTION: ATC handles fixed assertions — 403, error names the missing
      // capability, never a membership complaint (gate-before-membership)
      await api.projects.rejectProjectCreationMissingCapability(WORKSPACE_NOT_MEMBER_ID);
    },
  );
});
