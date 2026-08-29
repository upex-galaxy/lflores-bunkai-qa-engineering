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
import type {
  ActiveWorkspaceBody,
  ActiveWorkspaceError,
  ActiveWorkspaceResponse,
  ErrorEnvelope,
  WorkspaceCreateBody,
  WorkspaceCreateResponse,
  WorkspaceInviteCreateBody,
  WorkspaceInviteCreateResponse,
  WorkspaceInviteListResponse,
  WorkspacePatchBody,
  WorkspaceResponse,
} from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

// Re-export types for consumers that import from WorkspaceApi
export type {
  ActiveWorkspaceBody,
  ActiveWorkspaceError,
  ActiveWorkspaceResponse,
  ErrorEnvelope,
  WorkspaceCreateBody,
  WorkspaceCreateResponse,
  WorkspaceInvite,
  WorkspaceInviteCreateBody,
  WorkspaceInviteCreateResponse,
  WorkspaceInviteListResponse,
  WorkspacePatchBody,
  WorkspaceResponse,
} from '@schemas/workspace.types';

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

  /**
   * Helper: List a workspace's invites (pending/accepted/revoked).
   *
   * Read-only GET — used as a test-level verification step to confirm a
   * rejected invite create/revoke (BK-544/BK-548) left the invites list
   * unchanged. Not an ATC on its own. Called with the OWNER session/PAT,
   * restored after the restricted PAT under test is done, since RLS scopes
   * this list to admins/owners.
   *
   * @param workspaceId - Target workspace id
   * @returns Tuple with response and the invite list
   */
  @step
  async getWorkspaceInvites(workspaceId: string): Promise<[APIResponse, WorkspaceInviteListResponse]> {
    return this.apiGET<WorkspaceInviteListResponse>(`/workspaces/${workspaceId}/invites`);
  }

  /**
   * Helper: Issue a workspace invite with the OWNER session/PAT.
   *
   * Generate-pattern precondition — creates a fresh pending invite used to
   * set up BK-548's "revoke a pending invite" scenario. Called BEFORE the
   * test swaps `this.authToken` to the restricted PAT under test. Not an
   * ATC on its own: invite creation's own fixed assertions belong to a
   * future Candidate TC (BK-547-adjacent), out of this plan's scope.
   *
   * @param args - Target workspace id and the invite payload
   * @param args.workspaceId - Target workspace id
   * @param args.body - Invite payload (email, role)
   * @returns Tuple with response, the created invite, and sent payload
   */
  @step
  async createWorkspaceInvite(
    args: { workspaceId: string, body: WorkspaceInviteCreateBody },
  ): Promise<[APIResponse, WorkspaceInviteCreateResponse, WorkspaceInviteCreateBody]> {
    return this.apiPOST<WorkspaceInviteCreateResponse, WorkspaceInviteCreateBody>(
      `/workspaces/${args.workspaceId}/invites`,
      args.body,
    );
  }

  /**
   * Helper: Raw POST /api/v1/workspaces wrapper — bootstraps a new workspace
   * and enrolls the caller as its owner.
   *
   * The sole genuinely capability-free write in the API (BK-499's Implementation
   * Plan, "authenticated" posture bucket) — any PAT holding at least one scope
   * passes. Not an ATC on its own; `createWorkspaceWithAnyScope` (BK-671) owns
   * the fixed assertions. Also reusable as a Generate-pattern precondition by
   * any other TC that just needs "a fresh workspace where the caller is owner"
   * (e.g. BK-682, BK-684), without dragging in BK-671's own assertions.
   *
   * @param body - Workspace name and slug
   * @returns Tuple with response, the created workspace, and sent payload
   */
  @step
  async createWorkspace(
    body: WorkspaceCreateBody,
  ): Promise<[APIResponse, WorkspaceCreateResponse, WorkspaceCreateBody]> {
    return this.apiPOST<WorkspaceCreateResponse, WorkspaceCreateBody>('/workspaces', body);
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: Bootstrap a new workspace with an any-scope PAT - expects success (201)
   *
   * Complete flow:
   * 1. POST a fresh workspace name/slug to /api/v1/workspaces (ACTION)
   * 2. Validate the workspace was created with an owner assigned (fixed assertions)
   *
   * AC1's positive scenario: any PAT holding at least one scope passes —
   * `POST /workspaces` is the sole genuinely capability-free write (BK-499's
   * Implementation Plan, "authenticated" posture bucket).
   *
   * The follow-up "is the owner specifically ME?" check (GET /me) is a
   * test-level assertion — it composes a second endpoint and belongs in the
   * test file, not here.
   *
   * @param body - Workspace name and slug
   * @returns Tuple with response, the created workspace, and sent payload
   */
  @atc('BK-671')
  async createWorkspaceWithAnyScope(
    body: WorkspaceCreateBody,
  ): Promise<[APIResponse, WorkspaceCreateResponse, WorkspaceCreateBody]> {
    const [response, respBody, sentPayload] = await this.createWorkspace(body);

    // Fixed assertions - validates the bootstrap succeeded and an owner was assigned
    expect(response.status()).toBe(201);
    expect(respBody.workspace.id).toBeDefined();
    expect(respBody.workspace.owner_user_id).toBeDefined();

    return [response, respBody, sentPayload];
  }

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

  /**
   * ATC: Create a workspace invite using a PAT scoped only `atc:read` - expects rejection (403)
   *
   * Complete flow:
   * 1. POST an invite payload to /api/v1/workspaces/{id}/invites using a read-only-scoped PAT (ACTION)
   * 2. Validate the request is rejected with the canonical error envelope (fixed assertions)
   *
   * The follow-up "was an invite actually created?" check (GET .../invites, owner session) is
   * a test-level assertion — it composes a second endpoint under a DIFFERENT credential.
   *
   * @param args - Target workspace id and the invite payload
   * @param args.workspaceId - Target workspace id
   * @param args.invite - Invite payload (email, role)
   * @returns Tuple with response, error envelope, and sent payload
   */
  @atc('BK-544')
  async rejectInviteCreationWithReadOnlyPat(
    args: { workspaceId: string, invite: WorkspaceInviteCreateBody },
  ): Promise<[APIResponse, ErrorEnvelope, WorkspaceInviteCreateBody]> {
    const [response, body, sentPayload] = await this.apiPOST<ErrorEnvelope, WorkspaceInviteCreateBody>(
      `/workspaces/${args.workspaceId}/invites`,
      args.invite,
    );

    // Fixed assertions - validates the scope-based rejection
    expect(response.status()).toBe(403);
    expect(body.error.code).toBe('forbidden');

    return [response, body, sentPayload];
  }

  /**
   * ATC: Revoke a pending invite using a PAT without `workspace:admin` - expects rejection (403)
   *
   * Complete flow:
   * 1. DELETE a pending invite using a PAT scoped `atc:write`+`run:execute` (no `workspace:admin`) (ACTION)
   * 2. Validate the request is rejected with the canonical error envelope (fixed assertions)
   *
   * The follow-up "is the invite still pending?" check (GET .../invites, owner session) is
   * a test-level assertion — it composes a second endpoint under a DIFFERENT credential.
   *
   * @param args - Target workspace id and the pending invite's id
   * @param args.workspaceId - Target workspace id
   * @param args.inviteId - Pending invite id to attempt revoking
   * @returns Tuple with response and error envelope
   */
  @atc('BK-548')
  async rejectRevokeInviteWithoutAdminScope(
    args: { workspaceId: string, inviteId: string },
  ): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.apiDELETE<ErrorEnvelope>(
      `/workspaces/${args.workspaceId}/invites/${args.inviteId}`,
    );

    // Fixed assertions - validates the scope-based rejection
    expect(response.status()).toBe(403);
    expect(body.error.code).toBe('forbidden');

    return [response, body];
  }

  /**
   * ATC: Perform a workspace-admin action with a correctly-scoped, bound PAT - expects success (200)
   *
   * Complete flow:
   * 1. PATCH /api/v1/workspaces/{id} using a `workspace:admin`-scoped PAT bound to that same workspace (ACTION)
   * 2. Validate the workspace reflects the update (fixed assertions)
   *
   * Positive control, counterweight to BK-544/BK-548/BK-551 — single-call scope, no
   * test-level composition needed.
   *
   * @param args - Target workspace id and the patch payload
   * @param args.workspaceId - Target workspace id
   * @param args.body - Patch payload (name)
   * @returns Tuple with response, the updated workspace, and sent payload
   */
  @atc('BK-550')
  async allowWorkspaceAdminActionWithBoundPat(
    args: { workspaceId: string, body: WorkspacePatchBody },
  ): Promise<[APIResponse, WorkspaceResponse, WorkspacePatchBody]> {
    const [response, respBody, sentPayload] = await this.apiPATCH<WorkspaceResponse, WorkspacePatchBody>(
      `/workspaces/${args.workspaceId}`,
      args.body,
    );

    // Fixed assertions - validates the write succeeded and reflects the sent payload
    expect(response.status()).toBe(200);
    expect(respBody.workspace.name).toBe(args.body.name);

    return [response, respBody, sentPayload];
  }

  /**
   * ATC: Perform a workspace-admin action with a PAT bound to a different workspace - expects rejection (403)
   *
   * Complete flow:
   * 1. PATCH /api/v1/workspaces/{id} (workspace B) using a `workspace:admin`-scoped PAT bound to
   *    workspace A (ACTION)
   * 2. Validate the request is rejected with the verbatim wrong-workspace message (fixed assertions)
   *
   * Sibling of BK-550's "correctly scoped, correct workspace" positive partition — single-call
   * negative check, no test-level composition needed.
   *
   * @param args - Target workspace id (the PAT's NON-bound workspace) and the patch payload
   * @param args.workspaceId - Target workspace id (NOT the PAT's bound workspace)
   * @param args.body - Patch payload (name)
   * @returns Tuple with response, error envelope, and sent payload
   */
  @atc('BK-551')
  async rejectCrossWorkspaceAdminPat(
    args: { workspaceId: string, body: WorkspacePatchBody },
  ): Promise<[APIResponse, ErrorEnvelope, WorkspacePatchBody]> {
    const [response, body, sentPayload] = await this.apiPATCH<ErrorEnvelope, WorkspacePatchBody>(
      `/workspaces/${args.workspaceId}`,
      args.body,
    );

    // Fixed assertions - validates the workspace-binding rejection and its verbatim message
    expect(response.status()).toBe(403);
    expect(body.error.message).toBe('This token is scoped to a different workspace.');

    return [response, body, sentPayload];
  }
}
