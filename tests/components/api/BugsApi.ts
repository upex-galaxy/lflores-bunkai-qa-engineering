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
 * - GET /bugs/{id} - Read a single bug's full record
 * - POST /bugs/{id}/assign - Assign, reassign, or unassign a bug (BK-264)
 * - POST /bugs/{id}/status - Advance a bug's status one lifecycle stage (BK-264)
 */

import type { APIResponse } from '@playwright/test';
import type { BugAssignBody, BugDetail, BugError, BugStandaloneCreateBody, BugStatusTransitionBody } from '@schemas/bugs.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

// Re-export types for consumers that import from BugsApi
export type { BugAssignBody, BugDetail, BugError, BugStandaloneCreateBody, BugStatusTransitionBody } from '@schemas/bugs.types';

/** Union of the two write actions a workspace actor can take on a bug. */
export type BugWriteAction
  = | { kind: 'assign', payload: BugAssignBody }
    | { kind: 'status', payload: BugStatusTransitionBody };

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

  /**
   * Helper: Read a single bug's full record.
   *
   * Read-only GET — used as a test-level verification step to confirm a
   * rejected write left the bug unchanged. Not an ATC on its own.
   *
   * @param bugId - Target bug id
   * @returns Tuple with response and the bug record
   */
  @step
  async getBugById(bugId: string): Promise<[APIResponse, { bug: BugDetail }]> {
    const [response, body] = await this.apiGET<{ bug: BugDetail }>(`/bugs/${bugId}`);
    return [response, body];
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

  /**
   * ATC: Reject a write action (assign or status-change) from a Viewer-role actor - expects rejection (403)
   *
   * Complete flow:
   * 1. POST the action's payload to its endpoint, authenticated as a Viewer-role actor (ACTION)
   * 2. Validate the request is rejected with the canonical error envelope (fixed assertions)
   *
   * Parametrized (EP): "assign" and "status-change" share the same 403/not_a_member
   * outcome shape, so they are two Examples rows of this one ATC — see
   * atc/BK-486-reject-viewer-write.md §6 for the derivation.
   *
   * The follow-up "did the bug stay unchanged?" check (GET /bugs/{id}) is a
   * test-level assertion — it composes two different endpoints.
   *
   * @param bugId - Target bug id
   * @param action - Which write endpoint to call and its payload
   * @returns Tuple with response and error envelope
   */
  @atc('BK-486')
  async rejectWriteActionForViewer(
    bugId: string,
    action: BugWriteAction,
  ): Promise<[APIResponse, BugError]> {
    // ACTION: POST the action's payload to its dedicated endpoint
    const endpoint = action.kind === 'assign' ? `/bugs/${bugId}/assign` : `/bugs/${bugId}/status`;
    const [response, body] = await this.apiPOST<BugError, BugAssignBody | BugStatusTransitionBody>(
      endpoint,
      action.payload,
    );

    // Fixed assertions - validates the rejection and its canonical reason
    expect(response.status()).toBe(403);
    expect(body.error.code).toBe('forbidden');
    expect((body.error.details as { reason?: string } | undefined)?.reason).toBe('not_a_member');

    return [response, body];
  }
}
