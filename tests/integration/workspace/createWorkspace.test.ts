/**
 * KATA Architecture - Workspace Bootstrap Integration Tests
 *
 * Tests for the capability-free workspace bootstrap endpoint (POST /workspaces).
 * BK-499 AC1: any PAT holding at least one scope may create a workspace and
 * becomes its owner — the sole genuinely capability-free write in the API.
 *
 * Project: integration (depends on api-setup)
 */

import { config, expect, test } from '@TestFixture';

test.describe('BK-499: Workspace Bootstrap API', { tag: ['@critical', '@smoke'] }, () => {
  /**
   * ATC: BK-671
   *
   * Precondition: fresh login (cookie session) + mint a PAT with any scope
   * (mintPatWithScopes defaults to atc:read — the exact scope is irrelevant
   * to AC1, only that at least one exists, which is guaranteed at mint time).
   */
  test(
    'BK-499: should create workspace given PAT holds at least one scope',
    async ({ api }) => {
      // Precondition: authenticate fresh, mint a PAT with any scope
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      const pat = await api.tokens.mintPatWithScopes();
      api.setAuthToken(pat.token);

      // ACTION: bootstrap a new workspace (ATC handles fixed assertions — 201, owner assigned)
      const [, workspaceBody] = await api.workspace.createWorkspaceWithAnyScope({
        name: api.data.createTestId('Workspace'),
        slug: api.data.createTestId('ws').toLowerCase(),
      });

      // Test-level assertion: the owner is specifically THIS caller, not just
      // "an" owner — composes GET /me, a second endpoint, so it belongs here.
      const [, meBody] = await api.auth.getCurrentUser();
      expect(workspaceBody.workspace.owner_user_id).toBe(meBody.user.id);
    },
  );
});
