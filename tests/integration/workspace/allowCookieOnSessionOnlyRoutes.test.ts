/**
 * KATA Architecture - Session-Only Routes Integration Tests (Cookie positive control)
 *
 * BK-499 TC10 (BK-680): positive-control twin of BK-678/BK-679 — a cookie
 * session succeeds on both workspace-membership session-only routes,
 * proving the guard is a CHANNEL check, not a blanket rejection.
 *
 * Project: integration (depends on api-setup)
 */

import { config, test } from '@TestFixture';
import { authenticateAs } from '@utils/auth';

test.describe('BK-499: Session-only routes allow cookie sessions', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-680
   *
   * Precondition: OWNER (`config.testUser`) creates a disposable workspace,
   * then invites `config.testViewer` — a real, permanently provisioned
   * second identity (BK-264 QA Sandbox) — as a member. A freshly bootstrapped
   * workspace's SOLE OWNER is blocked from leaving it (409 `sole_owner`,
   * confirmed live on staging 2026-08-30), so this ATC needs a non-owner
   * member instead. `config.testViewer` then accepts the invite and IS the
   * caller for both session-only actions.
   */
  test(
    'BK-499: should allow cookie session on both session-only routes',
    async ({ api }) => {
      test.skip(!config.testViewer.email, 'BK-499: config.testViewer not provisioned for this environment');

      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      const [, wsBody] = await api.workspace.createWorkspace({
        name: api.data.createTestId('Workspace'),
        slug: api.data.createTestId('ws').toLowerCase(),
      });
      const workspaceId = wsBody.workspace.id;

      // Invite creation requires `workspace:admin`, which the ambient
      // auto-issued Bearer PAT from login does not carry (BK-166
      // coexistence) — clear it to force the cookie-session channel, which
      // always carries the owner role's full permission set (BR2).
      api.clearAuthToken();
      const [, inviteBody] = await api.workspace.createWorkspaceInvite({
        workspaceId,
        body: { email: config.testViewer.email, role: 'member' },
      });

      // Switch identity — config.testViewer accepts the invite, then is the
      // caller for both session-only actions below.
      await authenticateAs(api, { email: config.testViewer.email, password: config.testViewer.password });
      await api.workspace.acceptInvite({ token: inviteBody.token });

      // ACTION: ATC handles fixed assertions — 200 on both session-only routes
      await api.workspace.allowCookieSessionOnSessionOnlyRoutes(workspaceId);
    },
  );
});
