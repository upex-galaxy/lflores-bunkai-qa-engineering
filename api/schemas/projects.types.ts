/**
 * KATA Framework - Type Facade: Projects Domain
 *
 * Wired to `POST /api/v1/workspaces/{id}/projects` (BK-499's TC3/TC4/TC14/TC15
 * precondition-chain root — no GET/list endpoint exists at this path).
 *
 * Consumed by: tests/components/api/ProjectsApi.ts
 */

import type { components } from '@openapi';

// ============================================================================
// Endpoint Types - POST /api/v1/workspaces/{id}/projects
// ============================================================================

/** Request payload: { name, description? } — slug is auto-derived server-side. */
export type ProjectCreateBody = components['schemas']['ProjectCreateBody'];

/** Response wrapper: { project: Project } — 201 on success. */
export type ProjectCreateResponse = components['schemas']['ProjectCreateResponse'];

/** Full project record. */
export type Project = components['schemas']['Project'];

// ============================================================================
// Shared
// ============================================================================

/** Canonical error envelope — 400 / 401 / 403 / 409 / 422 depending on the failure. */
export type ErrorEnvelope = components['schemas']['ErrorEnvelope'];
