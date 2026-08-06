/**
 * KATA Architecture - Workspace Switch Integration Tests
 *
 * Tests for the active-workspace switch endpoint (POST /me/active-workspace).
 * Validates that a user with active membership in the target workspace has
 * their session scope rotated correctly.
 *
 * Project: integration (depends on api-setup)
 */

import { config, expect, test } from '@TestFixture';

test.describe('BK-6: Workspace Switch API', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-250
   *
   * Precondition: fresh login (no shared state across tests) + discover at
   * least 2 active workspace memberships via GET /me (Discover pattern —
   * never assert on precondition data, skip when the fixture is missing).
   */
  test(
    'BK-6: should update active workspace context when switching to a workspace given the user is an active member',
    async ({ api }) => {
      // Precondition: authenticate fresh
      const credentials = {
        email: config.testUser.email,
        password: config.testUser.password,
      };
      await api.auth.authenticateSuccessfully(credentials);

      // Precondition: discover workspace memberships (Discover pattern)
      const [, meBefore] = await api.auth.getCurrentUser();
      test.skip(meBefore.workspaces.length < 2, 'BK-6: test user needs >= 2 active workspace memberships');

      const workspaceTo = meBefore.workspaces.find(ws => ws.id !== meBefore.active_workspace_id)
        ?? meBefore.workspaces[1];

      // ACTION: switch active workspace (ATC handles fixed assertions — 200, id/slug/name)
      const [, switchBody] = await api.workspace.switchToActiveWorkspace({ workspace_id: workspaceTo.id });

      // Test-level assertion: the session scope actually rotated, not just
      // that the switch endpoint itself answered 200 — a follow-up GET /me
      // proves the change is session-wide, not a response that "lied".
      const [, meAfter] = await api.auth.getCurrentUser();
      expect(meAfter.active_workspace_id).toBe(workspaceTo.id);
      expect(switchBody.id).toBe(workspaceTo.id);
    },
  );
});
