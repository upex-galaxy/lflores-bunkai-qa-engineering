/**
 * KATA Architecture - Layer 3: Workspace API Component
 *
 * API component for workspace-membership operations.
 * Handles switching the caller's active-workspace session scope.
 *
 * ATCs follow flow-based design: each ATC is an ACTION + VERIFICATION,
 * not a simple POST. See atc/BK-250-switch-active-workspace.md for the
 * full contract (fixed vs test-level assertion split).
 *
 * Endpoints:
 * - POST /me/active-workspace - Switch the session's active workspace
 */

import type { APIResponse } from '@playwright/test';
import type { ActiveWorkspaceBody, ActiveWorkspaceError, ActiveWorkspaceResponse } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc } from '@utils/decorators';

// Re-export types for consumers that import from WorkspaceApi
export type { ActiveWorkspaceBody, ActiveWorkspaceError, ActiveWorkspaceResponse } from '@schemas/workspace.types';

// ============================================
// Workspace API Component
// ============================================

export class WorkspaceApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * POST /me/active-workspace using cookie-session auth only.
   *
   * Per BK-316's fix, this endpoint unconditionally rejects any caller that sends
   * an `Authorization: Bearer` header (403) — it is cookie-session-only by design;
   * Bearer/PAT callers must pass `workspace_id` explicitly per request instead.
   * This repo's `api` fixture attaches a Bearer token to every request once
   * authenticated (`ApiBase.buildHeaders`), so this endpoint specifically must
   * suspend it for the call, then restore it for whatever the test does next.
   */
  private async postActiveWorkspace<TBody>(
    payload: ActiveWorkspaceBody,
  ): Promise<[APIResponse, TBody, ActiveWorkspaceBody]> {
    const savedToken = this.authToken;
    this.clearAuthToken();
    try {
      return await this.apiPOST<TBody, ActiveWorkspaceBody>('/me/active-workspace', payload);
    }
    finally {
      if (savedToken) { this.setAuthToken(savedToken); }
    }
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: Switch active workspace to one where the caller is an active member - expects success (200)
   *
   * Complete flow:
   * 1. POST target workspace_id to /me/active-workspace, cookie-session only (ACTION)
   * 2. Validate response body reflects the target workspace (fixed assertions)
   *
   * The follow-up "did the session scope actually rotate?" check (GET /me) is a
   * test-level assertion, not a fixed one — it composes two different endpoints
   * and belongs in the test file, not here.
   *
   * @param payload - Target workspace id
   * @returns Tuple with response, workspace context, and sent payload
   */
  @atc('BK-250')
  async switchToActiveWorkspace(
    payload: ActiveWorkspaceBody,
  ): Promise<[APIResponse, ActiveWorkspaceResponse, ActiveWorkspaceBody]> {
    // ACTION: POST target workspace_id (cookie-session only — see postActiveWorkspace)
    const [response, body, sentPayload] = await this.postActiveWorkspace<ActiveWorkspaceResponse>(payload);

    // Fixed assertions - validates the switch succeeded and returned the target context
    expect(response.status()).toBe(200);
    expect(body.id).toBe(payload.workspace_id);
    expect(body.slug).toBeDefined();
    expect(body.name).toBeDefined();

    return [response, body, sentPayload];
  }

  /**
   * ATC: Switch active workspace to one where the caller has no membership row - expects rejection (403)
   *
   * Complete flow:
   * 1. POST target workspace_id to /me/active-workspace (ACTION)
   * 2. Validate the request is rejected with the canonical error envelope (fixed assertions)
   *
   * The follow-up "did the session stay on the pre-switch workspace?" check (GET /me) is a
   * test-level assertion — it composes two different endpoints and belongs in the test file.
   *
   * @param payload - Target workspace id (real workspace, zero membership rows for the caller)
   * @returns Tuple with response, error envelope, and sent payload
   */
  @atc('BK-251')
  async switchToNonMemberWorkspace(
    payload: ActiveWorkspaceBody,
  ): Promise<[APIResponse, ActiveWorkspaceError, ActiveWorkspaceBody]> {
    // ACTION: POST a workspace_id the caller has no membership row for (cookie-session only —
    // see postActiveWorkspace; a Bearer call would 403 unconditionally and never exercise
    // the membership check this ATC is meant to cover)
    const [response, body, sentPayload] = await this.postActiveWorkspace<ActiveWorkspaceError>(payload);

    // Fixed assertions - validates the switch was rejected with the canonical error code
    expect(response.status()).toBe(403);
    expect(body.error.code).toBe('forbidden');

    return [response, body, sentPayload];
  }

  /**
   * ATC: Switch active workspace to one where the caller's membership is suspended - expects rejection (403)
   *
   * Complete flow:
   * 1. POST target workspace_id to /me/active-workspace (ACTION)
   * 2. Validate the request is rejected with the canonical error envelope (fixed assertions)
   *
   * The follow-up "did the session stay on the pre-switch workspace?" check (GET /me) is a
   * test-level assertion — it composes two different endpoints and belongs in the test file.
   *
   * @param payload - Target workspace id (real workspace, caller has a `status = 'suspended'` membership row)
   * @returns Tuple with response, error envelope, and sent payload
   */
  @atc('BK-252')
  async switchToSuspendedWorkspace(
    payload: ActiveWorkspaceBody,
  ): Promise<[APIResponse, ActiveWorkspaceError, ActiveWorkspaceBody]> {
    // ACTION: POST a workspace_id where the caller's membership is suspended (cookie-session
    // only — see postActiveWorkspace; a Bearer call would 403 unconditionally and never
    // exercise the membership check this ATC is meant to cover)
    const [response, body, sentPayload] = await this.postActiveWorkspace<ActiveWorkspaceError>(payload);

    // Fixed assertions - validates the switch was rejected with the canonical error code
    expect(response.status()).toBe(403);
    expect(body.error.code).toBe('forbidden');

    return [response, body, sentPayload];
  }
}
