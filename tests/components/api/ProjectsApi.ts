/**
 * KATA Architecture - Layer 3: Projects API Component
 *
 * API component for project creation (BK-499's TC3/TC4 precondition-chain
 * root, and TC14/TC15's own capability-scope proof). No GET/list endpoint
 * exists at this path — `POST /workspaces/{id}/projects` only.
 *
 * ATCs follow flow-based design: each ATC is an ACTION + VERIFICATION,
 * not a simple POST. See atc/BK-684-*.md and siblings for the full
 * contracts (fixed vs test-level assertion split).
 *
 * Endpoints:
 * - POST /api/v1/workspaces/{id}/projects - Create a project (member-only, atc:write)
 */

import type { APIResponse } from '@playwright/test';
import type { ErrorEnvelope, Project, ProjectCreateBody, ProjectCreateResponse } from '@schemas/projects.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

// Re-export types for consumers that import from ProjectsApi
export type { ErrorEnvelope, Project, ProjectCreateBody, ProjectCreateResponse } from '@schemas/projects.types';

// ============================================
// Projects API Component
// ============================================

export class ProjectsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Helper: Raw POST /api/v1/workspaces/{id}/projects wrapper — creates a
   * project under whatever auth channel `this.authToken`/cookie jar is
   * currently set to.
   *
   * Read/write primitive shared by BK-684's own fixed assertions and any
   * other TC that just needs "a fresh project under a fresh workspace"
   * (e.g. BK-673/BK-674's precondition chain). Not an ATC on its own — it
   * carries no fixed assertions; callers own their own.
   *
   * @param args - Target workspace id and the project payload
   * @param args.workspaceId - Target workspace id
   * @param args.body - Project name, optional description
   * @returns Tuple with response, the created project, and sent payload
   */
  @step
  async createProject(
    args: { workspaceId: string, body: ProjectCreateBody },
  ): Promise<[APIResponse, ProjectCreateResponse, ProjectCreateBody]> {
    return this.apiPOST<ProjectCreateResponse, ProjectCreateBody>(`/workspaces/${args.workspaceId}/projects`, args.body);
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: Create a project with a correctly-scoped, member-role PAT - expects success (201)
   *
   * Complete flow:
   * 1. POST a fresh project name to /api/v1/workspaces/{id}/projects, using
   *    an `atc:write`-scoped PAT bound to a workspace the caller is at
   *    least a member of (ACTION)
   * 2. Validate the project was created (fixed assertions)
   *
   * AC8's positive scenario: `atc:write`-gated, member-role floor — owner
   * counts as member, so the BK-671 bootstrap flow satisfies the role
   * requirement without a separate invite.
   *
   * @param args - Target workspace id and the project payload
   * @param args.workspaceId - Target workspace id (caller is at least a member)
   * @param args.body - Project name, optional description
   * @returns Tuple with response, the created project, and sent payload
   */
  @atc('BK-684')
  async createProjectSuccessfully(
    args: { workspaceId: string, body: ProjectCreateBody },
  ): Promise<[APIResponse, ProjectCreateResponse, ProjectCreateBody]> {
    const [response, respBody, sentPayload] = await this.createProject(args);

    // Fixed assertions - validates the create succeeded and the project is real
    expect(response.status()).toBe(201);
    expect(respBody.project.id).toBeDefined();
    expect(respBody.project.name).toBe(args.body.name);

    return [response, respBody, sentPayload];
  }

  /**
   * ATC: Create a project with a PAT missing `atc:write` on a workspace the
   * caller is not a member of - expects rejection (403 naming the capability)
   *
   * Complete flow:
   * 1. POST a fresh project name to /api/v1/workspaces/{id}/projects, using
   *    a PAT scoped only `atc:read`, bound to a workspace the caller has no
   *    membership row for (ACTION)
   * 2. Validate the gate rejects it BEFORE any membership check runs — the
   *    error names the missing capability, not "not a member" (fixed assertions)
   *
   * Proves the capability gate runs before the downstream membership check
   * (BK-499's Implementation Plan TD-2), using the shared
   * `WORKSPACE_NOT_MEMBER_ID` fixture already established by BK-251.
   *
   * @param workspaceId - Target workspace id (caller has no membership row) — pass `WORKSPACE_NOT_MEMBER_ID`
   * @returns Tuple with response and error envelope
   */
  @atc('BK-685')
  async rejectProjectCreationMissingCapability(workspaceId: string): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.apiPOST<ErrorEnvelope, ProjectCreateBody>(`/workspaces/${workspaceId}/projects`, {
      name: this.data.createTestId('Project'),
    });

    // Fixed assertions - validates the gate-before-membership ordering: the
    // error names the missing capability, never a membership complaint
    expect(response.status()).toBe(403);
    expect(body.error.message).toContain('atc:write');

    return [response, body];
  }
}
