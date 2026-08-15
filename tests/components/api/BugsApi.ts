/**
 * KATA Architecture - Layer 3: Bugs API Component
 *
 * API component for defect-triage operations: filing bugs and assigning them
 * to a workspace member.
 *
 * ATCs follow flow-based design: each ATC is an ACTION + VERIFICATION,
 * not a simple POST. See atc/BK-477-assign-eligible-member.md for the
 * full contract (fixed vs test-level assertion split).
 *
 * Endpoints:
 * - POST /bugs - File a standalone bug (BK-40)
 * - POST /bugs/{id}/assign - Assign, reassign, or unassign a bug (BK-264)
 */

import type { APIResponse } from '@playwright/test';
import type { BugAssignBody, BugDetail, BugStandaloneCreateBody } from '@schemas/bugs.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

// Re-export types for consumers that import from BugsApi
export type { BugAssignBody, BugDetail, BugStandaloneCreateBody } from '@schemas/bugs.types';

// ============================================
// Bugs API Component
// ============================================

export class BugsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Helper: File a standalone bug (not run-linked).
   *
   * Generate-pattern precondition — used by ATCs and tests that need a
   * fresh, isolated bug (status "open", no assignee) rather than relying
   * on shared fixture data. Not an ATC on its own: BK-40 (bug filing)
   * already owns this flow's fixed assertions; here it is a fixture step.
   *
   * @param payload - project_id, module_id, title, severity (see BugStandaloneCreateBody)
   * @returns Tuple with response, the filed bug, and sent payload
   */
  @step
  async fileBugSuccessfully(
    payload: BugStandaloneCreateBody,
  ): Promise<[APIResponse, { bug: BugDetail }, BugStandaloneCreateBody]> {
    const [response, body, sentPayload] = await this.apiPOST<{ bug: BugDetail }, BugStandaloneCreateBody>(
      '/bugs',
      payload,
    );
    expect(response.status()).toBe(201);
    expect(body.bug.id).toBeDefined();
    expect(body.bug.status).toBe('open');
    expect(body.bug.assignee_user_id).toBeNull();
    return [response, body, sentPayload];
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: Assign an open, unassigned bug to an eligible workspace member - expects success (200)
   *
   * Complete flow:
   * 1. POST assignee_user_id to /bugs/{id}/assign (ACTION)
   * 2. Validate response body reflects the target assignee (fixed assertions)
   *
   * Parametrized (EP): "member" and "owner" roles share the same 200 outcome
   * shape, so they are two Examples rows of this one ATC — see
   * atc/BK-477-assign-eligible-member.md §6 for the derivation.
   *
   * @param bugId - Target bug id (open, unassigned)
   * @param payload - Target assignee_user_id
   * @returns Tuple with response, the updated bug, and sent payload
   */
  @atc('BK-477')
  async assignBugToEligibleMember(
    bugId: string,
    payload: BugAssignBody,
  ): Promise<[APIResponse, { bug: BugDetail }, BugAssignBody]> {
    // ACTION: POST the eligible assignee's user id
    const [response, body, sentPayload] = await this.apiPOST<{ bug: BugDetail }, BugAssignBody>(
      `/bugs/${bugId}/assign`,
      payload,
    );

    // Fixed assertions - validates the assignment succeeded and returned the target context
    expect(response.status()).toBe(200);
    expect(body.bug.id).toBe(bugId);
    expect(body.bug.assignee_user_id).toBe(payload.assignee_user_id);

    return [response, body, sentPayload];
  }
}
