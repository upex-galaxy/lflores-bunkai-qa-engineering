/**
 * KATA Architecture - Workspace Switch Integration Tests
 *
 * Tests for the active-workspace switch endpoint (POST /me/active-workspace).
 * Validates that a user with active membership in the target workspace has
 * their session scope rotated correctly.
 *
 * Project: integration (depends on api-setup)
 */

import { WORKSPACE_NOT_MEMBER_ID } from '@data/constants';
import { config, expect, test } from '@TestFixture';

/**
 * Fixed reference workspace where the BK-6 test user HAS a `workspace_members` row but
 * its `status` is `suspended`. Re-seeded 2026-11-12 for the staging-user-migration:
 * owned by `STAGING_MEMBER_EMAIL`, the test user invited + accepted as `member` via the
 * API, then the row hand-mutated to `suspended` via `QA_INSPECTOR_RW_URL` (the product
 * exposes no suspend endpoint; the `staging-dbhub` MCP connection is READ-ONLY), verified
 * via SELECT immediately after. No runtime DB client exists in this framework, so a
 * permanent documented fixture is the only viable strategy — same convention as
 * WORKSPACE_NOT_MEMBER_ID above. See atc/BK-252-switch-suspended-workspace.md §7 for the
 * original decision trail.
 *
 * RESERVED FIXTURE — do not reactivate this membership, do not delete the workspace or the
 * row. Doing so breaks this TC with a false result, not a real regression. This workspace
 * is also therefore excluded from BK-250's active-membership discovery pool.
 */
const WORKSPACE_SUSPENDED_ID = '4527091f-47ff-44f8-a8d6-560122fb52de'; // QA Suspended Membership Fixture

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
      // Per BK-316, GET /me's Bearer branch resolves from an immutable,
      // mint-time-bound field and never reflects a switch — cookie-session
      // is the only rail where a switch is observable, so the verification
      // call must drop Bearer to check the real invariant.
      api.auth.clearAuthToken();
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

  /**
   * ATC: BK-252
   *
   * Precondition: fresh login + a fixed reference workspace where the caller HAS a
   * membership row but its status is `suspended` (WORKSPACE_SUSPENDED_ID — see the
   * file-level comment above for the hand-mutated-fixture decision trail).
   */
  test(
    'BK-6: should reject workspace switch given the user has a suspended membership',
    async ({ api }) => {
      // Precondition: authenticate fresh
      const credentials = {
        email: config.testUser.email,
        password: config.testUser.password,
      };
      await api.auth.authenticateSuccessfully(credentials);

      const [, meBefore] = await api.auth.getCurrentUser();

      // ACTION: attempt switch to a workspace where the caller's membership is suspended
      // (ATC handles fixed assertions — 403, error.code === 'forbidden')
      await api.workspace.switchToSuspendedWorkspace({ workspace_id: WORKSPACE_SUSPENDED_ID });

      // Test-level assertion: the session did NOT partially rotate on a rejected
      // request — active_workspace_id stays exactly what it was before the attempt.
      const [, meAfter] = await api.auth.getCurrentUser();
      expect(meAfter.active_workspace_id).toBe(meBefore.active_workspace_id);
    },
  );
});
