/**
 * KATA Architecture - Layer 3: Runs API Component
 *
 * API component for test runs. Today it exposes one helper: submitting a
 * finished run in a single call, used as a precondition by the BK-259 Home
 * coverage suite (an AC only counts as "executed" once its ATC's most recent
 * run row is passed or failed).
 *
 * No ATC lives here yet: nothing under test targets the runs endpoints. The
 * method is a helper (no `@atc`) because it only prepares data; callers own
 * their own assertions.
 *
 * Endpoints:
 * - POST /api/v1/runs/submissions - Submit a finished run (Bearer, scope run:execute, member+)
 */

import type { APIResponse } from '@playwright/test';
import type { ErrorEnvelope, RunSubmissionPayload, RunSubmissionResponse } from '@schemas/runs.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { step } from '@utils/decorators';

// Re-export types for consumers that import from RunsApi
export type { ErrorEnvelope, RunSubmissionPayload, RunSubmissionResponse } from '@schemas/runs.types';

// ============================================
// Runs API Component
// ============================================

export class RunsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers (no fixed assertions, callers own theirs)
  // ============================================

  /**
   * Helper: Raw POST /runs/submissions wrapper - creates a Run that is already
   * finished, with the submitted step results. The route reads the workspace
   * from the Test, so no workspace id is sent.
   *
   * @param payload - Test, environment NAME, verdict and one result per chain position
   * @returns Tuple with response, body (run, or the error envelope) and the sent payload
   */
  @step
  async submitRun(payload: RunSubmissionPayload): Promise<[APIResponse, RunSubmissionResponse | ErrorEnvelope, RunSubmissionPayload]> {
    return this.apiPOST<RunSubmissionResponse | ErrorEnvelope, RunSubmissionPayload>('/runs/submissions', payload);
  }
}
