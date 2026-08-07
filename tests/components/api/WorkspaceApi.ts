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
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: Switch active workspace to one where the caller is an active member - expects success (200)
   *
   * Complete flow:
   * 1. POST target workspace_id to /me/active-workspace (ACTION)
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
    // ACTION: POST target workspace_id
    const [response, body, sentPayload] = await this.apiPOST<ActiveWorkspaceResponse, ActiveWorkspaceBody>(
      '/me/active-workspace',
      payload,
    );

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
    // ACTION: POST a workspace_id the caller has no membership row for
    const [response, body, sentPayload] = await this.apiPOST<ActiveWorkspaceError, ActiveWorkspaceBody>(
      '/me/active-workspace',
      payload,
    );

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
    // ACTION: POST a workspace_id where the caller's membership is suspended
    const [response, body, sentPayload] = await this.apiPOST<ActiveWorkspaceError, ActiveWorkspaceBody>(
      '/me/active-workspace',
      payload,
    );

    // Fixed assertions - validates the switch was rejected with the canonical error code
    expect(response.status()).toBe(403);
    expect(body.error.code).toBe('forbidden');

    return [response, body, sentPayload];
  }
}
