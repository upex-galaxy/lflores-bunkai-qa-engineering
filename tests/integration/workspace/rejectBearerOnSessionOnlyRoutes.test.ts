/**
 * KATA Architecture - Session-Only Routes Integration Tests (Bearer rejection leg)
 *
 * BK-499 TC8/TC9 (BK-678/BK-679): AC5's session-only guard on the two
 * workspace-membership routes — a full-scope Bearer PAT is unconditionally
 * rejected on both, regardless of scope, workspace_id validity, or
 * membership state. Sibling positive control (cookie session succeeds on
 * both) lives in `allowCookieOnSessionOnlyRoutes.test.ts`.
 *
 * Project: integration (depends on api-setup)
 */

import { test } from '@TestFixture';
import { useIdentity } from '@utils/auth';

test.describe('BK-499: Session-only routes reject Bearer PATs', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-678
   *
   * Precondition: cached owner identity + mint a full-scope PAT + discover any
   * workspace the caller is a member of (the channel guard fires before the
   * workspace id is resolved, so membership is irrelevant to the outcome).
   */
  test(
    'BK-499: should reject given full-scope Bearer PAT on the leave-workspace route',
    async ({ api }) => {
      await useIdentity(api, 'owner', { withSession: true });

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['atc:read', 'atc:write', 'run:execute'] });
      api.setAuthToken(pat.token);

      const [, me] = await api.auth.getCurrentUser();
      test.skip(me.workspaces.length === 0, 'BK-499: test user needs at least one workspace membership');
      const workspaceId = me.workspaces[0].id;

      // ACTION: ATC handles fixed assertions — 403, verbatim "Use a browser session." message
      await api.workspace.rejectBearerOnDeleteMembership(workspaceId);
    },
  );

  /**
   * ATC: BK-679
   *
   * Precondition: cached owner identity + mint a full-scope PAT + discover any
   * workspace. BK-623 (message omitted "Use a browser session.") confirmed
   * fixed live on staging 2026-08-30 — no longer red-by-design.
   */
  test(
    'BK-499: should reject given full-scope Bearer PAT on the switch-active-workspace route',
    async ({ api }) => {
      await useIdentity(api, 'owner', { withSession: true });

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['atc:read', 'atc:write', 'run:execute'] });
      api.setAuthToken(pat.token);

      const [, me] = await api.auth.getCurrentUser();
      test.skip(me.workspaces.length === 0, 'BK-499: test user needs at least one workspace membership');
      const workspaceId = me.workspaces[0].id;

      // ACTION: ATC handles fixed assertions — 403, verbatim "Use a browser session." message
      await api.workspace.rejectBearerOnPostActiveWorkspaceMessage({ workspace_id: workspaceId });
    },
  );
});
