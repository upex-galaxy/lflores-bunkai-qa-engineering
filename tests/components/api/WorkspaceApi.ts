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
import type { ActiveWorkspaceBody, ActiveWorkspaceResponse } from '@schemas/workspace.types';
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
}
