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
// Shared
// ============================================================================

/** Canonical error envelope — 401 / 403 / 404 / 409 / 422 depending on the endpoint. */
export type ErrorEnvelope = components['schemas']['ErrorEnvelope'];
