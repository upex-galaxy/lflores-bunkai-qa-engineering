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

/**
 * Fixed reference workspace where the BK-6 test user has zero `workspace_members`
 * rows — validated via direct staging DB query on 2026-08-07. No runtime DB client
 * exists in this framework and no API endpoint can discover a "workspace I am NOT a
 * member of" (would be a cross-tenant data leak), so a fixed, documented reference is
 * the only viable Discover-adjacent strategy here (Generate via signup+email+confirm
 * was rejected as disproportionate for a single negative-path check). See
 * atc/BK-251-switch-non-member-workspace.md §7 for the full decision trail.
 *
 * RESERVED FIXTURE — do not add the BK-6 test user as a member of this workspace, and
 * do not delete it. Doing so breaks this TC with a false result, not a real regression.
 */
const WORKSPACE_NOT_MEMBER_ID = '047c106e-5334-4a80-8b66-d99ef4c474b4'; // bunkai1-qa

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

  /**
   * ATC: BK-251
   *
   * Precondition: fresh login + a fixed reference workspace where the caller has
   * no membership row (WORKSPACE_NOT_MEMBER_ID — see the file-level comment above
   * for why this is a documented constant rather than a runtime Discover).
   */
  test(
    'BK-6: should reject workspace switch given the user has no active membership',
    async ({ api }) => {
      // Precondition: authenticate fresh
      const credentials = {
        email: config.testUser.email,
        password: config.testUser.password,
      };
      await api.auth.authenticateSuccessfully(credentials);

      const [, meBefore] = await api.auth.getCurrentUser();

      // ACTION: attempt switch to a workspace with zero membership rows for the caller
      // (ATC handles fixed assertions — 403, error.code === 'forbidden')
      await api.workspace.switchToNonMemberWorkspace({ workspace_id: WORKSPACE_NOT_MEMBER_ID });

      // Test-level assertion: the session did NOT partially rotate on a rejected
      // request — active_workspace_id stays exactly what it was before the attempt.
      const [, meAfter] = await api.auth.getCurrentUser();
      expect(meAfter.active_workspace_id).toBe(meBefore.active_workspace_id);
    },
  );
});
