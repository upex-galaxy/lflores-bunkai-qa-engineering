/**
 * KATA Architecture - Layer 3: Modules API Component
 *
 * API component for module creation and per-module user-story listing —
 * the Decision-Table anchor family for BK-498's capability-scope enforcement
 * on the authoring domain: `atc:write` gates module creation, `atc:read`
 * gates the nested user-stories read, independently of each other.
 *
 * ATCs follow flow-based design: each ATC is an ACTION + VERIFICATION,
 * not a simple POST/GET. See atc/BK-556-*.md and siblings for the full
 * contracts (fixed vs test-level assertion split).
 *
 * Endpoints:
 * - POST /api/v1/projects/{project_id}/modules - Create a module (member-only, atc:write)
 * - GET /api/v1/modules/{module_id}/user-stories - List a module's active user stories (member-only, atc:read)
 */

import type { APIResponse } from '@playwright/test';
import type { ErrorEnvelope, ModulePayload, ModuleResponse, UserStoriesListResponse } from '@schemas/modules.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { request as apiRequest, expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

// Re-export types for consumers that import from ModulesApi
export type { ErrorEnvelope, ModulePayload, ModuleResponse, UserStoriesListResponse } from '@schemas/modules.types';

// ============================================
// Modules API Component
// ============================================

export class ModulesApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Helper: Raw POST /api/v1/projects/{project_id}/modules wrapper — creates
   * a module under whatever auth channel `this.authToken`/cookie jar is
   * currently set to.
   *
   * Read/write primitive shared by every write ATC in this component. Not an
   * ATC on its own — it carries no fixed assertions; callers own their own.
   *
   * @param projectId - Target project id
   * @param payload - Module name, optional description/parent
   * @returns Tuple with response, the created module, and sent payload
   */
  @step
  async createModule(projectId: string, payload: ModulePayload): Promise<[APIResponse, ModuleResponse, ModulePayload]> {
    return this.apiPOST<ModuleResponse, ModulePayload>(`/projects/${projectId}/modules`, payload);
  }

  /**
   * Helper: Raw GET /api/v1/modules/{module_id}/user-stories wrapper — lists
   * a module's active user stories under whatever auth channel is currently set.
   *
   * Reused by every read ATC in this component. Not an ATC on its own.
   *
   * @param moduleId - Target module id
   * @returns Tuple with response and the user-stories list
   */
  @step
  async getModuleUserStories(moduleId: string): Promise<[APIResponse, UserStoriesListResponse]> {
    return this.apiGET<UserStoriesListResponse>(`/modules/${moduleId}/user-stories`);
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: Create a module using a PAT scoped exactly `atc:write` - expects success (201)
   *
   * Complete flow:
   * 1. POST a module payload to /projects/{id}/modules using an `atc:write`-scoped
   *    PAT bound to the target workspace (ACTION)
   * 2. Validate the module was created (fixed assertions)
   *
   * Positive control, anchor TC for the Modules family — single-call scope, no
   * test-level composition needed.
   *
   * @param projectId - Target project id
   * @param payload - Module payload
   * @returns Tuple with response, the created module, and sent payload
   */
  @atc('BK-556')
  async createModuleSuccessfully(
    projectId: string,
    payload: ModulePayload,
  ): Promise<[APIResponse, ModuleResponse, ModulePayload]> {
    const [response, body, sentPayload] = await this.createModule(projectId, payload);

    // Fixed assertions - validates the write succeeded and the created module is identifiable
    // NOTE: the created module id lives at body.module.id, not body.id (ModuleCreateResponse
    // wraps the row) — differs from TokensApi's flat CreateTokenResponse shape.
    expect(response.status()).toBe(201);
    expect(body.module.id).toBeDefined();

    return [response, body, sentPayload];
  }

  /**
   * ATC: Create a module using a PAT scoped exactly `atc:read` - expects rejection (403)
   *
   * Complete flow:
   * 1. POST a module payload to /projects/{id}/modules using an `atc:read`-only PAT (ACTION)
   * 2. Validate the request is rejected for missing `atc:write` (fixed assertions)
   *
   * The follow-up "was a module actually created?" zero-side-effect check is a
   * test-level assertion — it composes a second read and belongs in the test file.
   *
   * @param projectId - Target project id
   * @param payload - Module payload
   * @returns Tuple with response, error envelope, and sent payload
   */
  @atc('BK-560')
  async rejectModuleCreationReadOnlyPat(
    projectId: string,
    payload: ModulePayload,
  ): Promise<[APIResponse, ErrorEnvelope, ModulePayload]> {
    const [response, body, sentPayload] = await this.apiPOST<ErrorEnvelope, ModulePayload>(
      `/projects/${projectId}/modules`,
      payload,
    );

    // Fixed assertions - validates the scope-based rejection names the missing capability
    expect(response.status()).toBe(403);
    expect(body.error.message).toContain('atc:write');

    return [response, body, sentPayload];
  }

  /**
   * ATC: Create a module using an unbound `atc:write` PAT held by a real member - expects success (201)
   *
   * Complete flow:
   * 1. POST a module payload to /projects/{id}/modules using an `atc:write`-scoped PAT
   *    with NO `workspace_id` binding, held by a real workspace member (ACTION)
   * 2. Validate the module was created — proves capability gating depends on scope +
   *    real membership, not token-workspace binding (fixed assertions, AC-07)
   *
   * @param projectId - Target project id
   * @param payload - Module payload
   * @returns Tuple with response, the created module, and sent payload
   */
  @atc('BK-562')
  async createModuleWithUnboundPat(
    projectId: string,
    payload: ModulePayload,
  ): Promise<[APIResponse, ModuleResponse, ModulePayload]> {
    const [response, body, sentPayload] = await this.createModule(projectId, payload);

    // Fixed assertions - validates the write succeeded regardless of token-workspace binding
    expect(response.status()).toBe(201);
    expect(body.module.id).toBeDefined();

    return [response, body, sentPayload];
  }

  /**
   * ATC: List a module's user stories using a PAT scoped `atc:read` - expects success (200)
   *
   * Complete flow:
   * 1. GET /modules/{id}/user-stories using an `atc:read`-scoped PAT (ACTION)
   * 2. Validate a user-stories list is returned (fixed assertions, AC-08a)
   *
   * @param moduleId - Target module id
   * @returns Tuple with response and the user-stories list
   */
  @atc('BK-564')
  async listUserStoriesSuccessfully(moduleId: string): Promise<[APIResponse, UserStoriesListResponse]> {
    const [response, body] = await this.getModuleUserStories(moduleId);

    // Fixed assertions - validates the read succeeded and the gate is capability-based
    expect(response.status()).toBe(200);
    expect(Array.isArray(body.user_stories)).toBe(true);

    return [response, body];
  }

  /**
   * ATC: Read a module's user stories using a PAT scoped only `atc:write` - expects rejection (403)
   *
   * Complete flow:
   * 1. GET /modules/{id}/user-stories using an `atc:write`-only PAT (ACTION)
   * 2. Validate the request is rejected for missing `atc:read` (fixed assertions)
   *
   * Read-mirror of BK-560 — proves the read gate is `atc:read` specifically, not
   * "any authenticated capability".
   *
   * @param moduleId - Target module id
   * @returns Tuple with response and error envelope
   */
  @atc('BK-565')
  async rejectReadWithWriteOnlyPat(moduleId: string): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.apiGET<ErrorEnvelope>(`/modules/${moduleId}/user-stories`);

    // Fixed assertions - validates the scope-based rejection names the missing capability
    expect(response.status()).toBe(403);
    expect(body.error.message).toContain('atc:read');

    return [response, body];
  }

  /**
   * ATC: Create a module with no Authorization header and no cookie session - expects rejection (401)
   *
   * Complete flow:
   * 1. POST a module payload to /projects/{id}/modules with the Authorization header
   *    omitted entirely (ACTION)
   * 2. Validate the request is rejected for missing authentication — distinct failure
   *    surface from the capability `403` in BK-560/BK-565 (absent credential ≠
   *    under-scoped credential) (fixed assertions)
   *
   * Precondition contract: none — this ATC builds its own throwaway,
   * genuinely-anonymous `APIRequestContext` rather than reusing
   * `this.request`/`apiPOST`. The `smoke` Playwright project sets
   * `storageState` (session cookie from `ui-setup`) at the project level,
   * and a shared request context inherits it even when `this.authToken` is
   * cleared (Bearer PAT + session cookie coexist per BK-166) — an explicit
   * empty `storageState` is the only way to reach a truly unauthenticated
   * request, same fix as `tests/integration/auth/user-session.test.ts`'s
   * "should fail without token" case.
   *
   * @param projectId - Target project id
   * @param payload - Module payload
   * @returns Tuple with response, error envelope, and sent payload
   */
  @atc('BK-567')
  async rejectUnauthenticatedModuleCreation(
    projectId: string,
    payload: ModulePayload,
  ): Promise<[APIResponse, ErrorEnvelope, ModulePayload]> {
    const anonymous = await apiRequest.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const response = await anonymous.post(this.apiEndpoint(`/projects/${projectId}/modules`), {
        headers: { 'Accept': '*/*', 'Content-Type': 'application/json' },
        data: payload,
      });
      const body = await this.getResponseJsonObject<ErrorEnvelope>(response);

      // Fixed assertions - validates the auth-required rejection, distinct from a capability 403
      expect(response.status()).toBe(401);
      expect(body.error.message).toBe('Authentication required.');

      return [response, body, payload];
    }
    finally {
      await anonymous.dispose();
    }
  }

  // NOTE: BK-569 (TC7 — rejectModuleCreationNonMember) intentionally NOT implemented
  // in this batch. Live staging probe (2026-08-21) showed the precondition itself is
  // unconstructible: `POST /tokens` with `workspace_id: WORKSPACE_NOT_MEMBER_ID` 403s
  // at MINT time (`"You are not a member of the target workspace."`) — the staging
  // test user cannot bind a PAT to a workspace they don't belong to at all, so the
  // planned "bound-to-non-member-workspace PAT targets a different, real project"
  // shape (automation-plan.md §7 Risk 1) can never reach the /modules endpoint under
  // this account. Flagged in the Batch B report; needs a second real user account
  // (a member of BK264's workspace's project but not of WORKSPACE_NOT_MEMBER_ID
  // reversed, or vice-versa) to reconstruct a valid non-member scenario — Code-phase
  // follow-up, not implemented here to avoid fabricating an assertion for a code path
  // never actually exercised.

  /**
   * ATC: Create a module, then list its user stories, using a default-scoped PAT -
   * expects success on both (201/200)
   *
   * Complete flow:
   * 1. POST a module payload to /projects/{id}/modules using a PAT scoped with the
   *    framework's default capability set (ACTION 1)
   * 2. GET /modules/{id}/user-stories using the same PAT (ACTION 2 / VERIFICATION)
   *
   * Embeds 2 raw HTTP calls — not other `@atc` methods — so this does not violate the
   * ATC-calls-ATC rule. Non-regression control: confirms the common-case default-scope
   * token loses nothing from this Story's enforcement change (mirrors TokensApi's
   * `BK-545` embedded-chain pattern). Precondition contract: caller must have already
   * set `this.authToken` to a PAT minted with the framework's default scope set
   * (`['atc:read', 'atc:write', 'run:execute']`) before invoking this ATC.
   *
   * @param projectId - Target project id
   * @param moduleId - Target module id (read back after creation)
   * @param payload - Module payload
   * @returns Tuple with the create and list responses
   */
  @atc('BK-570')
  async defaultScopeSucceedsOnWriteAndRead(
    projectId: string,
    moduleId: string,
    payload: ModulePayload,
  ): Promise<[APIResponse, APIResponse]> {
    // ACTION 1: create
    const [createResponse, createBody] = await this.createModule(projectId, payload);
    expect(createResponse.status()).toBe(201);
    expect(createBody.module.id).toBeDefined();

    // ACTION 2: list (VERIFICATION that reads still succeed under the same PAT)
    const [listResponse, listBody] = await this.getModuleUserStories(moduleId);
    expect(listResponse.status()).toBe(200);
    expect(Array.isArray(listBody.user_stories)).toBe(true);

    return [createResponse, listResponse];
  }

  /**
   * ATC: Create a module via an authenticated browser session, no PAT involved -
   * expects success (201)
   *
   * Complete flow:
   * 1. POST a module payload to /projects/{id}/modules using only the session cookie
   *    (ACTION)
   * 2. Validate the module was created — browser sessions carry the full capability
   *    set and are never narrowed like a PAT can be (fixed assertions)
   *
   * Precondition contract: caller must have already called `authenticateSuccessfully()`
   * (establishes the session cookie) and then `clearAuthToken()` (forces cookie-only,
   * no Bearer PAT).
   *
   * @param projectId - Target project id
   * @param payload - Module payload
   * @returns Tuple with response, the created module, and sent payload
   */
  @atc('BK-557')
  async createModuleViaSessionRegardlessOfPatScope(
    projectId: string,
    payload: ModulePayload,
  ): Promise<[APIResponse, ModuleResponse, ModulePayload]> {
    const [response, body, sentPayload] = await this.createModule(projectId, payload);

    // Fixed assertions - validates the write succeeded over cookie-only auth
    expect(response.status()).toBe(201);
    expect(body.module.id).toBeDefined();

    return [response, body, sentPayload];
  }

  /**
   * ATC: Create a module using a revoked `atc:write` PAT - expects rejection (401)
   *
   * Complete flow:
   * 1. POST a module payload to /projects/{id}/modules using a PAT that was minted
   *    then immediately revoked (ACTION)
   * 2. Validate the request is rejected at 401 — NOT 403 — with the verbatim
   *    identity-resolution message, proving token-revocation is checked before the
   *    capability gate (distinct from BK-560/BK-565's valid-but-under-scoped 403)
   *    (fixed assertions)
   *
   * Precondition contract: caller must mint a PAT, revoke it (session-authenticated),
   * then `setAuthToken()` the now-revoked raw token string before invoking this ATC.
   *
   * @param projectId - Target project id
   * @param payload - Module payload
   * @returns Tuple with response, error envelope, and sent payload
   */
  @atc('BK-558')
  async rejectRevokedTokenWithInvalidMessage(
    projectId: string,
    payload: ModulePayload,
  ): Promise<[APIResponse, ErrorEnvelope, ModulePayload]> {
    const [response, body, sentPayload] = await this.apiPOST<ErrorEnvelope, ModulePayload>(
      `/projects/${projectId}/modules`,
      payload,
    );

    // Fixed assertions - validates the revoked-token 401, distinct from a capability 403
    expect(response.status()).toBe(401);
    expect(body.error.message).toBe('Invalid token.');

    return [response, body, sentPayload];
  }
}
