/**
 * KATA Framework - Type Facade: Bugs Domain
 *
 * Wired to the real `POST /api/v1/bugs`, `POST /api/v1/bugs/{id}/assign`,
 * and `POST /api/v1/bugs/{id}/status` endpoints (BK-40, BK-264).
 *
 * Consumed by: tests/components/api/BugsApi.ts
 */

import type { components } from '@openapi';

// ============================================================================
// Endpoint Types - POST /api/v1/bugs (BK-40, standalone filing)
// ============================================================================

/** Request payload for filing a standalone bug (not run-linked). */
export type BugStandaloneCreateBody = components['schemas']['BugStandaloneCreateBody'];

/** Full composed Bug record — returned by create/assign/status and the single-bug read. */
export type BugDetail = components['schemas']['BugDetail'];

// ============================================================================
// Endpoint Types - POST /api/v1/bugs/{id}/assign (BK-264)
// ============================================================================

/** Request payload: { assignee_user_id: uuid | null } — null unassigns. */
export type BugAssignBody = components['schemas']['BugAssignBody'];

// ============================================================================
// Endpoint Types - POST /api/v1/bugs/{id}/status (BK-264)
// ============================================================================

/** Request payload: { status: "open" | "in_progress" | "resolved" | "closed" } */
export type BugStatusTransitionBody = components['schemas']['BugStatusTransitionBody'];

// ============================================================================
// Shared
// ============================================================================

/** Canonical error envelope — 401 / 403 / 404 / 422 depending on the endpoint. */
export type BugError = components['schemas']['ErrorEnvelope'];
