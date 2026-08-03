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
