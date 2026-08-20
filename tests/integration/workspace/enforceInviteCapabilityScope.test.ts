/**
 * KATA Architecture - Workspace Invite Capability Scope Integration Tests
 *
 * Non-regression guards for BK-497's PAT scope enforcement on workspace-invite
 * mutations: invite creation requires `workspace:admin` (BK-544), and invite
 * revocation requires it too (BK-548) — neither is satisfied by narrower scopes.
 *
 * Project: integration (depends on api-setup)
 */

import { config, expect, test } from '@TestFixture';
import { getOwnedWorkspace } from '@utils/workspace';

test.describe('BK-497: Workspace Invite Capability Scope API', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-544
   *
   * Precondition: fresh login + discover a workspace the caller OWNS (invite
   * creation is admin/owner-only via RLS — `active_workspace_id` is not
   * guaranteed to be an owned workspace, it can be a plain "member" one) +
   * mint an `atc:read`-only PAT bound to it, set as the ambient Bearer token
   * on `workspace`.
   */
  test(
    'BK-497: should reject invite creation when the PAT is scoped only to atc:read',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      const [, me] = await api.auth.getCurrentUser();
      const ownedWorkspace = getOwnedWorkspace(me);
      test.skip(!ownedWorkspace, 'BK-497: test user needs to own at least one workspace');
      if (!ownedWorkspace) { return; }
      const workspaceId = ownedWorkspace.id;

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['atc:read'], workspace_id: workspaceId });
      api.workspace.setAuthToken(pat.token);

      const targetEmail = api.data.createUser().email;

      // ACTION: ATC handles fixed assertions — 403, error.code === 'forbidden'
      await api.workspace.rejectInviteCreationWithReadOnlyPat({
        workspaceId,
        invite: { email: targetEmail, role: 'member' },
      });

      // Test-level assertion: no invite was created for the target email
      // (OWNER session, restored — a different credential than the one under test)
      api.workspace.clearAuthToken();
      const [, invitesBody] = await api.workspace.getWorkspaceInvites(workspaceId);
      expect(invitesBody.invites.some(invite => invite.email === targetEmail)).toBe(false);
    },
  );

  /**
   * ATC: BK-548
   *
   * Precondition: fresh login + discover a workspace the caller OWNS (same
   * admin/owner-only rationale as BK-544) + Generate a pending invite (OWNER
   * session) + mint an `atc:write`+`run:execute` PAT bound to the workspace
   * (no `workspace:admin`), set as the ambient Bearer token on `workspace`.
   */
  test(
    'BK-497: should reject pending-invite revocation when the PAT lacks workspace:admin',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      const [, me] = await api.auth.getCurrentUser();
      const ownedWorkspace = getOwnedWorkspace(me);
      test.skip(!ownedWorkspace, 'BK-497: test user needs to own at least one workspace');
      if (!ownedWorkspace) { return; }
      const workspaceId = ownedWorkspace.id;

      // Precondition: Generate a pending invite with the OWNER session (pure cookie auth).
      // The `api` fixture pre-loads the persisted default PAT (api-state.json, scopes
      // atc:read/atc:write/run:execute — no workspace:admin) onto every component at
      // construction time, so `workspace.authToken` is NOT null here by default — it must
      // be explicitly cleared or this call would ride that under-scoped Bearer token instead.
      api.workspace.clearAuthToken();
      const [, createdInvite] = await api.workspace.createWorkspaceInvite({
        workspaceId,
        body: { email: api.data.createUser().email, role: 'member' },
      });

      const pat = await api.tokens.mintPatWithScopes({
        scopes: ['atc:write', 'run:execute'],
        workspace_id: workspaceId,
      });
      api.workspace.setAuthToken(pat.token);

      // ACTION: ATC handles fixed assertions — 403, error.code === 'forbidden'
      await api.workspace.rejectRevokeInviteWithoutAdminScope({
        workspaceId,
        inviteId: createdInvite.invite.id,
      });

      // Test-level assertion: the invite's revoked_at is still null
      // (OWNER session, restored — a different credential than the one under test)
      api.workspace.clearAuthToken();
      const [, invitesBody] = await api.workspace.getWorkspaceInvites(workspaceId);
      const invite = invitesBody.invites.find(item => item.id === createdInvite.invite.id);
      expect(invite?.revoked_at).toBeNull();
    },
  );
});
