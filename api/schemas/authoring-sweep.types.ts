/**
 * KATA Framework - Type Facade: Authoring Sweep Domain
 *
 * Wired to 5 authoring-domain endpoints across 5 resource families (BK-498 —
 * capability-scope enforcement, cross-family sweep: TC11-15). Minimal
 * create-payload + response shape per family — enough to build a valid write
 * and read back its status, not full CRUD.
 *
 * - POST /api/v1/modules/{id}/user-stories        -> UserStoryPayload / UserStoryResponse
 * - GET  /api/v1/user-stories/{id}                 -> UserStoryResponse
 * - POST /api/v1/user-stories/{id}/acceptance-criteria -> AcceptanceCriterionPayload / AcceptanceCriterionResponse
 * - GET  /api/v1/acceptance-criteria/{id}          -> AcceptanceCriterionResponse
 * - POST /api/v1/projects/{id}/environments        -> EnvironmentPayload / EnvironmentResponse
 * - GET  /api/v1/projects/{id}/environments        -> EnvironmentListResponse
 * - POST /api/v1/projects/{id}/milestones          -> MilestonePayload / MilestoneResponse
 * - GET  /api/v1/projects/{id}/milestones          -> MilestoneListResponse
 * - POST /api/v1/imports                           -> ImportPayload / ImportEnqueueResponse
 * - GET  /api/v1/imports/{id}                      -> ImportJobResponse
 *
 * Consumed by: tests/components/api/AuthoringSweepApi.ts
 */

import type { components } from '@openapi';

// ============================================================================
// User Stories
// ============================================================================

/** Request payload for POST /modules/{id}/user-stories: { title, description?, external_id? } */
export type UserStoryPayload = components['schemas']['UserStoryCreateBody'];

/** Response for both the create and the GET /user-stories/{id} read — the row lives at `user_story`. */
export interface UserStoryResponse {
  user_story: components['schemas']['UserStory']
}

// ============================================================================
// Acceptance Criteria
// ============================================================================

/** Request payload for POST /user-stories/{id}/acceptance-criteria: { title, description?, position? } */
export type AcceptanceCriterionPayload = components['schemas']['AcceptanceCriterionCreateBody'];

/** Response for both the create and the GET /acceptance-criteria/{id} read — the row lives at `acceptance_criterion`. */
export interface AcceptanceCriterionResponse {
  acceptance_criterion: components['schemas']['AcceptanceCriterion']
}

// ============================================================================
// Environments
// ============================================================================

/** Request payload for POST /projects/{id}/environments: { name } */
export type EnvironmentPayload = components['schemas']['ProjectEnvironmentCreateBody'];

/** Response for the create — the row lives at `environment`. */
export type EnvironmentResponse = components['schemas']['ProjectEnvironmentCreateResponse'];

/** Response for the list-read (GET /projects/{id}/environments) — no single-item read exists for this family. */
export type EnvironmentListResponse = components['schemas']['ProjectEnvironmentListResponse'];

// ============================================================================
// Milestones
// ============================================================================

/** Request payload for POST /projects/{id}/milestones: { name, target_date (YYYY-MM-DD), description? } */
export type MilestonePayload = components['schemas']['MilestoneCreateBody'];

/** Response for the create — the row lives at `milestone`. */
export type MilestoneResponse = components['schemas']['MilestoneCreateResponse'];

/** Response for the list-read (GET /projects/{id}/milestones) — no single-item read exists for this family. */
export type MilestoneListResponse = components['schemas']['MilestoneListResponse'];

// ============================================================================
// Imports
// ============================================================================

/** Request payload for POST /imports: { project_id, jql } */
export type ImportPayload = components['schemas']['ImportCreateBody'];

/** Response for the enqueue call (202) — no named OpenAPI schema, the shape is inline in the path. */
export interface ImportEnqueueResponse {
  import_job_id: string
  status: string
}

/** Response for GET /imports/{id} — the row lives at `import_job`. */
export interface ImportJobResponse {
  import_job: components['schemas']['ImportJob']
}

// ============================================================================
// Shared
// ============================================================================

// ErrorEnvelope is intentionally NOT redefined here — reuse @schemas/modules.types's
// ErrorEnvelope (same canonical shape across every authoring-domain endpoint).
