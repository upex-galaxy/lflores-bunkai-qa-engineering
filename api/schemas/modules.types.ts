/**
 * KATA Framework - Type Facade: Modules Domain
 *
 * Wired to the real `POST /api/v1/projects/{id}/modules` and
 * `GET /api/v1/modules/{id}/user-stories` endpoints (BK-498 — capability-scope
 * enforcement on the authoring domain).
 *
 * Consumed by: tests/components/api/ModulesApi.ts
 */

import type { components } from '@openapi';

// ============================================================================
// Endpoint Types - POST /api/v1/projects/{id}/modules
// ============================================================================

/** Request payload for creating a module: { name, description?, parent_module_id? } */
export type ModulePayload = components['schemas']['ModuleCreateBody'];

/** Response for a freshly-created module — the created module is at `module`, not the root. */
export type ModuleResponse = components['schemas']['ModuleCreateResponse'];

// ============================================================================
// Endpoint Types - GET /api/v1/modules/{id}/user-stories
// ============================================================================

/**
 * Response for GET /api/v1/modules/{id}/user-stories — { user_stories: [...] }.
 * Kept minimal (not the full `UserStory` shape) — Batch A's TCs only assert
 * list-shape/status, not individual story fields.
 */
export interface UserStoriesListResponse {
  user_stories: Array<{ id: string, title: string, [key: string]: unknown }>
}

// ============================================================================
// Shared
// ============================================================================

/** Canonical error envelope — 400 / 401 / 403 / 409 / 422 depending on the endpoint. */
export type ErrorEnvelope = components['schemas']['ErrorEnvelope'];
