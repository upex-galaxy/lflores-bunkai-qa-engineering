/**
 * KATA Framework - Type Facade: Runs Domain
 *
 * Wired to the real `POST /api/v1/runs/submissions` endpoint: a finished
 * automated Run submitted in one call, with every chain step's result.
 *
 * Consumed by: tests/components/api/RunsApi.ts
 */

import type { components } from '@openapi';

// ============================================================================
// Endpoint Types - POST /api/v1/runs/submissions
// ============================================================================

/** Request payload: { test_id, environment (NAME), verdict, steps[{position, result}], duration_seconds?, evidence_urls?, idempotency_key? } */
export type RunSubmissionPayload = components['schemas']['RunSubmissionBody'];

/** One step result: { position (1..N in the Test's chain), result: 'pass' | 'fail' | 'block' } */
export type RunSubmissionStep = components['schemas']['RunSubmissionStep'];

/** Success response: { run } - 201 on create, 200 when the idempotency key replays an existing run. */
export interface RunSubmissionResponse {
  run: components['schemas']['Run']
}

/** Canonical error envelope - 401 / 403 / 404 / 409 / 422 */
export type ErrorEnvelope = components['schemas']['ErrorEnvelope'];
