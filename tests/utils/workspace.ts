/**
 * KATA Architecture - Shared Workspace Test Helpers
 *
 * Small, agnostic helpers for test-level workspace lookups that don't belong
 * on a KATA component (not an HTTP call, not Playwright-specific).
 * Centralizes logic duplicated across integration test files (DRY principle).
 *
 * Used by:
 * - tests/integration/workspace/enforceInviteCapabilityScope.test.ts
 * - tests/integration/workspace/enforceWorkspaceAdminCapabilityScope.test.ts
 */

import type { UserInfoResponse } from '@schemas/auth.types';

// ============================================
// Helpers
// ============================================

/**
 * Finds the first workspace in `/api/v1/me`'s `workspaces` list that the
 * caller OWNS (`owner_user_id === me.user.id`). Several BK-497 non-regression
 * guards need an owner-scoped workspace specifically — `active_workspace_id`
 * is not guaranteed to be one, it can be a plain "member" workspace.
 *
 * @param me - The `/api/v1/me` response body
 * @returns The owned workspace, or `undefined` if the caller owns none
 */
export function getOwnedWorkspace(me: UserInfoResponse): UserInfoResponse['workspaces'][number] | undefined {
  return me.workspaces.find(ws => ws.owner_user_id === me.user.id);
}
