/**
 * KATA Framework - Type Facade: Workspace Domain
 *
 * Wired to the real `POST /api/v1/me/active-workspace` endpoint.
 *
 * Consumed by: tests/components/api/WorkspaceApi.ts
 */

import type { components } from '@openapi';

// ============================================================================
// Endpoint Types - POST /api/v1/me/active-workspace
// ============================================================================

/** Request payload: { workspace_id: string (uuid) } */
export type ActiveWorkspaceBody = components['schemas']['ActiveWorkspaceBody'];

/** Success response: { id, slug, name, role } — cookie `bk_active_ws` set, Supabase JWT untouched */
export type ActiveWorkspaceResponse = components['schemas']['ActiveWorkspaceResponse'];

/** Canonical error envelope — 401 (not signed in) / 403 (not an active member) / 422 (validation) */
export type ActiveWorkspaceError = components['schemas']['ErrorEnvelope'];

// ============================================================================
// Endpoint Types - POST /api/v1/workspaces (BK-499)
// ============================================================================

/** Request payload: { name, slug } — bootstrap a new workspace, caller becomes owner. */
export type WorkspaceCreateBody = components['schemas']['WorkspaceCreateBody'];

/** Response wrapper: { workspace: Workspace } — 201 on success. */
export type WorkspaceCreateResponse = components['schemas']['WorkspaceCreateResponse'];

// ============================================================================
// Endpoint Types - PATCH /api/v1/workspaces/{id} (BK-497)
// ============================================================================

/** Request payload: { name? } — owner-only update, slug rotation is post-MVP. */
export type WorkspacePatchBody = components['schemas']['WorkspacePatchBody'];

/** Response wrapper: { workspace: Workspace } — shared by GET and PATCH /workspaces/{id}. */
export type WorkspaceResponse = components['schemas']['WorkspaceResponse'];

/** Full workspace record. */
export type Workspace = components['schemas']['Workspace'];

// ============================================================================
// Endpoint Types - /api/v1/workspaces/{id}/invites[/{inviteId}] (BK-497)
// ============================================================================

/** Request payload for POST /api/v1/workspaces/{id}/invites: { email, role? }. */
export type WorkspaceInviteCreateBody = components['schemas']['WorkspaceInviteCreateBody'];

/** Response for a freshly-created invite — raw `token` shown exactly once. */
export type WorkspaceInviteCreateResponse = components['schemas']['WorkspaceInviteCreateResponse'];

/** Response for GET /api/v1/workspaces/{id}/invites — { invites: WorkspaceInvite[] }. */
export type WorkspaceInviteListResponse = components['schemas']['WorkspaceInviteListResponse'];

/** One invite row — includes `revoked_at`, used to confirm a rejected revoke left it untouched. */
export type WorkspaceInvite = components['schemas']['WorkspaceInvite'];

// ============================================================================
// Endpoint Types - DELETE /api/v1/workspaces/{id}/membership (BK-499)
// ============================================================================

/** Response for a successful leave — `{ newActiveWorkspaceId, newActiveWorkspaceName }`, both nullable. */
export type WorkspaceLeaveResponse = components['schemas']['WorkspaceLeaveResponse'];

// ============================================================================
// Endpoint Types - POST /api/v1/invites/accept (BK-499 TC10 precondition)
// ============================================================================

/** Request payload: { token } — the raw invite token from `WorkspaceInviteCreateResponse.token`. */
export type InviteAcceptBody = components['schemas']['InviteAcceptBody'];

/** Response: `{ ok, workspace_id, role }`. */
export type InviteAcceptResponse = components['schemas']['InviteAcceptResponse'];

// ============================================================================
// Shared
// ============================================================================

/** Canonical error envelope — 401 / 403 / 404 / 409 / 422 depending on the endpoint. */
export type ErrorEnvelope = components['schemas']['ErrorEnvelope'];
