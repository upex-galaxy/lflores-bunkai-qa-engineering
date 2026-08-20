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
import type { ActivityItemResponse, ActivityPageResponse } from '@schemas/activity.types';
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

  /**
   * ATC: Reject a status change that skips a lifecycle stage - expects rejection (422)
   *
   * @param bugId - Target bug id
   * @param payload - Target status that skips one or more stages ahead
   * @returns Tuple with response and error envelope
   */
  @atc('BK-478')
  async rejectStatusSkip(
    bugId: string,
    payload: BugStatusTransitionBody,
  ): Promise<[APIResponse, BugError]> {
    const [response, body] = await this.apiPOST<BugError, BugStatusTransitionBody>(
      `/bugs/${bugId}/status`,
      payload,
    );

    expect(response.status()).toBe(422);
    expect(body.error.code).toBe('validation_failed');
    expect((body.error.details as { reason?: string } | undefined)?.reason).toBe('status_transition_skipped');

    return [response, body];
  }

  /**
   * ATC: Advance a bug's status given a legal forward transition - expects success (200)
   *
   * Parametrized (EP): the 3 legal forward transitions (open->in_progress,
   * in_progress->resolved, resolved->closed) share the same 200 outcome
   * shape, so they are three Examples rows of this one ATC.
   *
   * @param bugId - Target bug id, seeded at the transition's current status
   * @param payload - Target status (the only legal next stage)
   * @returns Tuple with response, the updated bug, and sent payload
   */
  @atc('BK-479')
  async advanceStatusLegally(
    bugId: string,
    payload: BugStatusTransitionBody,
  ): Promise<[APIResponse, { bug: BugDetail }, BugStatusTransitionBody]> {
    const [response, body, sentPayload] = await this.apiPOST<{ bug: BugDetail }, BugStatusTransitionBody>(
      `/bugs/${bugId}/status`,
      payload,
    );

    expect(response.status()).toBe(200);
    expect(body.bug.id).toBe(bugId);
    expect(body.bug.status).toBe(payload.status);

    return [response, body, sentPayload];
  }

  /**
   * ATC: Reject assignment given the target is not a workspace member - expects rejection (422)
   *
   * @param bugId - Target bug id
   * @param nonMemberUserId - A user id with no workspace_members row in the bug's workspace
   * @returns Tuple with response and error envelope
   */
  @atc('BK-480')
  async rejectAssignToNonMember(
    bugId: string,
    nonMemberUserId: string,
  ): Promise<[APIResponse, BugError]> {
    const [response, body] = await this.apiPOST<BugError, BugAssignBody>(
      `/bugs/${bugId}/assign`,
      { assignee_user_id: nonMemberUserId },
    );

    expect(response.status()).toBe(422);
    expect(body.error.code).toBe('validation_failed');
    expect((body.error.details as { reason?: string } | undefined)?.reason).toBe('assignee_not_workspace_member');

    return [response, body];
  }

  /**
   * ATC: Reject assignment given the target is a Viewer-role member - expects rejection (422)
   *
   * @param bugId - Target bug id
   * @param viewerUserId - An active workspace_members row with role "viewer"
   * @returns Tuple with response and error envelope
   */
  @atc('BK-481')
  async rejectAssignToViewer(
    bugId: string,
    viewerUserId: string,
  ): Promise<[APIResponse, BugError]> {
    const [response, body] = await this.apiPOST<BugError, BugAssignBody>(
      `/bugs/${bugId}/assign`,
      { assignee_user_id: viewerUserId },
    );

    expect(response.status()).toBe(422);
    expect(body.error.code).toBe('validation_failed');
    expect((body.error.details as { reason?: string } | undefined)?.reason).toBe('assignee_view_only');

    return [response, body];
  }

  /**
   * ATC: Reject a status change that moves backward or repeats the current status - expects rejection (422)
   *
   * Parametrized (EP): 3 genuine-backward rows + 1 same-status row all fold
   * into the same 422/status_transition_backward outcome shape per the
   * endpoint's documented behavior.
   *
   * @param bugId - Target bug id
   * @param payload - Target status that moves backward or repeats the current one
   * @returns Tuple with response and error envelope
   */
  @atc('BK-482')
  async rejectStatusBackwardOrSame(
    bugId: string,
    payload: BugStatusTransitionBody,
  ): Promise<[APIResponse, BugError]> {
    const [response, body] = await this.apiPOST<BugError, BugStatusTransitionBody>(
      `/bugs/${bugId}/status`,
      payload,
    );

    expect(response.status()).toBe(422);
    expect(body.error.code).toBe('validation_failed');
    expect((body.error.details as { reason?: string } | undefined)?.reason).toBe('status_transition_backward');

    return [response, body];
  }

  /**
   * ATC: Update the assignee when reassigning to a different eligible member - expects success (200)
   *
   * @param bugId - Target bug id, already assigned to a different member
   * @param payload - New assignee_user_id (differs from the current one)
   * @returns Tuple with response, the updated bug, and sent payload
   */
  @atc('BK-483')
  async reassignBugToDifferentMember(
    bugId: string,
    payload: BugAssignBody,
  ): Promise<[APIResponse, { bug: BugDetail }, BugAssignBody]> {
    const [response, body, sentPayload] = await this.apiPOST<{ bug: BugDetail }, BugAssignBody>(
      `/bugs/${bugId}/assign`,
      payload,
    );

    expect(response.status()).toBe(200);
    expect(body.bug.id).toBe(bugId);
    expect(body.bug.assignee_user_id).toBe(payload.assignee_user_id);

    return [response, body, sentPayload];
  }

  /**
   * ATC: Clear the assignee when unassigning - expects success (200)
   *
   * @param bugId - Target bug id, already assigned
   * @returns Tuple with response and the updated bug
   */
  @atc('BK-485')
  async unassignBug(bugId: string): Promise<[APIResponse, { bug: BugDetail }]> {
    const [response, body] = await this.apiPOST<{ bug: BugDetail }, BugAssignBody>(
      `/bugs/${bugId}/assign`,
      { assignee_user_id: null },
    );

    expect(response.status()).toBe(200);
    expect(body.bug.id).toBe(bugId);
    expect(body.bug.assignee_user_id).toBeNull();

    return [response, body];
  }

  /**
   * ATC: Keep assignee and status changes independent of each other - expects success (200)
   *
   * Parametrized (EP): reassigning and changing status share the same "the
   * write itself succeeds" 200 outcome shape as fixed assertions; which
   * other* field stayed untouched is a test-level assertion (composes a
   * second GET), per KATA Rule 7.
   *
   * @param bugId - Target bug id
   * @param action - Which write endpoint to call and its payload
   * @returns Tuple with response and the updated bug
   */
  @atc('BK-484')
  async keepAssigneeAndStatusIndependent(
    bugId: string,
    action: BugWriteAction,
  ): Promise<[APIResponse, { bug: BugDetail }]> {
    const endpoint = action.kind === 'assign' ? `/bugs/${bugId}/assign` : `/bugs/${bugId}/status`;
    const [response, body] = await this.apiPOST<{ bug: BugDetail }, BugAssignBody | BugStatusTransitionBody>(
      endpoint,
      action.payload,
    );

    expect(response.status()).toBe(200);
    expect(body.bug.id).toBe(bugId);

    return [response, body];
  }

  /**
   * ATC: Return a non-disclosing 404 given the bug does not exist or is outside the caller's workspace - expects rejection (404)
   *
   * Parametrized (EP): a nonexistent id and a real id from an unrelated
   * workspace both return the identical 404/not_found shape (non-disclosing
   * by design), so they are two Examples rows of this one ATC.
   *
   * @param bugId - A bug id that either doesn't exist or belongs to another workspace
   * @returns Tuple with response and error envelope
   */
  @atc('BK-488')
  async rejectNonDisclosingNotFound(bugId: string): Promise<[APIResponse, BugError]> {
    const [response, body] = await this.apiPOST<BugError, BugAssignBody>(
      `/bugs/${bugId}/assign`,
      { assignee_user_id: null },
    );

    expect(response.status()).toBe(404);
    expect(body.error.code).toBe('not_found');

    return [response, body];
  }

  /**
   * ATC: Assign an unassigned bug for the first time - expects success (200)
   *
   * Complete flow mirrors assignBugToEligibleMember, but this is its own
   * TC (BK-489) because the test-level follow-up is different: it confirms
   * the assignment write triggers exactly 1 new `notifications` row for
   * BK-212's benefit, not just that the assignee field was set.
   *
   * @param bugId - Target bug id, open and unassigned
   * @param payload - Target assignee_user_id
   * @returns Tuple with response, the updated bug, and sent payload
   */
  @atc('BK-489')
  async assignBugTriggersNotification(
    bugId: string,
    payload: BugAssignBody,
  ): Promise<[APIResponse, { bug: BugDetail }, BugAssignBody]> {
    const [response, body, sentPayload] = await this.apiPOST<{ bug: BugDetail }, BugAssignBody>(
      `/bugs/${bugId}/assign`,
      payload,
    );

    expect(response.status()).toBe(200);
    expect(body.bug.id).toBe(bugId);
    expect(body.bug.assignee_user_id).toBe(payload.assignee_user_id);

    return [response, body, sentPayload];
  }

  /**
   * ATC: Attribute a bug write action to the actor who actually made the
   * call, never the bug's assignee or a third party - expects success (200)
   *
   * Complete flow:
   * 1. POST the action's payload to its dedicated endpoint (ACTION)
   * 2. GET /activity for the workspace, newest first, and find the row for
   *    this bug + this action - no server-side entity filter exists, so the
   *    feed is paged and filtered client-side (VERIFICATION)
   * 3. Validate the matching activity row exists and its actor is the caller
   *    that made the request (fixed assertions)
   *
   * Whether the actor differs from the resulting assignee is a test-level
   * assertion — it composes the returned item's `actor` against its own
   * `payload`, which is beyond this ATC's single-endpoint scope.
   *
   * @param args - Target bug/workspace, the action to perform, and the expected actor
   * @param args.bugId - Target bug id
   * @param args.workspaceId - Workspace the bug belongs to (required for the /activity read)
   * @param args.action - Which write endpoint to call and its payload
   * @param args.expectedActorUserId - The user id that should show up as the activity row's actor
   * @returns Tuple with the /activity response and the matched activity item
   */
  @atc('BK-487')
  async attributeActionToActualCaller(args: {
    bugId: string
    workspaceId: string
    action: BugWriteAction
    expectedActorUserId: string
  }): Promise<[APIResponse, ActivityItemResponse]> {
    // ACTION: POST the action's payload to its dedicated endpoint
    const endpoint = args.action.kind === 'assign' ? `/bugs/${args.bugId}/assign` : `/bugs/${args.bugId}/status`;
    const [actionResponse] = await this.apiPOST<{ bug: BugDetail }, BugAssignBody | BugStatusTransitionBody>(
      endpoint,
      args.action.payload,
    );
    expect(actionResponse.status()).toBe(200);

    // VERIFICATION: page the activity feed and find the matching row client-side
    // (no server-side entity filter exists — GET /activity only takes workspace_id/limit/cursor)
    const expectedAction = args.action.kind === 'assign' ? 'bug.assigned' : 'bug.status_changed';
    const [activityResponse, page] = await this.apiGET<ActivityPageResponse>('/activity', {
      params: { workspace_id: args.workspaceId, limit: '50' },
    });
    expect(activityResponse.status()).toBe(200);

    const matched = page.items.find(item => item.item.entity_id === args.bugId && item.action === expectedAction);

    // Fixed assertions - the activity row exists and its actor matches the true caller
    expect(matched).toBeDefined();
    expect(matched?.actor.user_id).toBe(args.expectedActorUserId);

    return [activityResponse, matched as ActivityItemResponse];
  }
}
