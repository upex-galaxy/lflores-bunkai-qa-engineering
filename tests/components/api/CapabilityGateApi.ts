/**
 * KATA Architecture - Layer 3: Capability Gate API Component
 *
 * Cross-cutting proof of BK-499's capability-scope gate itself, not any one
 * resource — mirrors the product code's own `lib/api/capability-enforcement.test.ts`
 * separation. Every ATC here samples a different combination of (auth
 * channel, scope set) against a gated route and asserts the gate's verdict.
 *
 * Each ATC assumes the caller's identity (PAT or session cookie, with
 * whatever scopes) is ALREADY established by the test's precondition — this
 * component never mints tokens or authenticates on its own.
 *
 * Endpoints:
 * - GET /api/v1/activity - Workspace activity feed, `atc:read`-gated (session bypasses the gate entirely)
 */

import type { APIResponse } from '@playwright/test';
import type { ActivityPageResponse, ErrorEnvelope } from '@schemas/activity.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc } from '@utils/decorators';

// ============================================
// Capability Gate API Component
// ============================================

export class CapabilityGateApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: `atc:write`-only PAT against a read-gated route - expects rejection (403)
   *
   * Complete flow:
   * 1. GET /api/v1/activity using a PAT scoped only `atc:write` (ACTION)
   * 2. Validate the gate rejects it — write does not substitute for read (fixed assertion)
   *
   * Confirms no write-to-read scope hierarchy exists (exact-match capability
   * check, `lib/api/principal.ts`).
   *
   * @param workspaceId - Workspace to query (any workspace the caller can resolve)
   * @returns Tuple with response and error envelope
   */
  @atc('BK-675')
  async rejectWriteOnlyPatOnReadGatedRoute(workspaceId: string): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.apiGET<ErrorEnvelope>('/activity', {
      params: { workspace_id: workspaceId },
    });

    // Fixed assertion - atc:write does not substitute for atc:read
    expect(response.status()).toBe(403);

    return [response, body];
  }

  /**
   * ATC: `atc:read` PAT with an unrelated extra scope against a read-gated route - expects success (200)
   *
   * Complete flow:
   * 1. GET /api/v1/activity using a PAT scoped `atc:read` + `run:execute` (ACTION)
   * 2. Validate the request succeeds and returns data — the extra unrelated
   *    scope is inert (fixed assertions)
   *
   * Guards against a naive future implementation that might treat scope
   * arrays positionally or exclusively instead of as a membership set.
   *
   * @param workspaceId - Workspace to query (any workspace the caller can resolve)
   * @returns Tuple with response and the activity page
   */
  @atc('BK-676')
  async allowReadPatWithExtraUnrelatedScope(workspaceId: string): Promise<[APIResponse, ActivityPageResponse]> {
    const [response, body] = await this.apiGET<ActivityPageResponse>('/activity', {
      params: { workspace_id: workspaceId },
    });

    // Fixed assertions - the extra unrelated scope does not interfere
    expect(response.status()).toBe(200);
    expect(Array.isArray(body.items)).toBe(true);

    return [response, body];
  }

  /**
   * ATC: browser session (no PAT) against a capability-gated route - expects success (200)
   *
   * Complete flow:
   * 1. GET /api/v1/activity using only the session cookie, no Bearer PAT (ACTION)
   * 2. Validate the request succeeds — the capability check never applies to
   *    a session-authenticated principal (fixed assertions)
   *
   * Proves Business Rule 2: a browser session always carries its role's full
   * effective permission set and is never scope-restricted, because a
   * session principal carries no `capabilities` array to check against.
   *
   * @param workspaceId - Workspace to query (any workspace the caller can resolve)
   * @returns Tuple with response and the activity page
   */
  @atc('BK-681')
  async allowBrowserSessionOnGatedRouteNoScopeCheck(workspaceId: string): Promise<[APIResponse, ActivityPageResponse]> {
    const [response, body] = await this.apiGET<ActivityPageResponse>('/activity', {
      params: { workspace_id: workspaceId },
    });

    // Fixed assertions - session callers bypass the capability check entirely
    expect(response.status()).toBe(200);
    expect(Array.isArray(body.items)).toBe(true);

    return [response, body];
  }

  /**
   * ATC: owner-role PAT missing the required capability - expects rejection (403)
   *
   * Complete flow:
   * 1. GET /api/v1/activity using a PAT scoped only `run:execute`, bound to a
   *    workspace the caller OWNS (ACTION)
   * 2. Validate the gate rejects it — owning the workspace does not
   *    substitute for holding the capability (fixed assertion)
   *
   * Proves AC7: workspace role never substitutes for a missing capability,
   * even for the workspace's own owner.
   *
   * @param workspaceId - Workspace the caller owns
   * @returns Tuple with response and error envelope
   */
  @atc('BK-682')
  async rejectOwnerRoleMissingCapability(workspaceId: string): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.apiGET<ErrorEnvelope>('/activity', {
      params: { workspace_id: workspaceId },
    });

    // Fixed assertion - owner role does not substitute for the missing capability
    expect(response.status()).toBe(403);

    return [response, body];
  }

  /**
   * ATC: viewer-role PAT holding the required capability - expects success (200)
   *
   * Complete flow:
   * 1. GET /api/v1/activity using a PAT scoped `atc:read`, bound to a
   *    workspace the caller is a Viewer (not owner) of (ACTION)
   * 2. Validate the request succeeds and returns data (fixed assertions)
   *
   * Confirms the capability check is scope-driven, not role-driven — a
   * lower-privileged role with the right capability still passes.
   *
   * @param workspaceId - Workspace the caller is a Viewer member of
   * @returns Tuple with response and the activity page
   */
  @atc('BK-683')
  async allowViewerRoleWithCapability(workspaceId: string): Promise<[APIResponse, ActivityPageResponse]> {
    const [response, body] = await this.apiGET<ActivityPageResponse>('/activity', {
      params: { workspace_id: workspaceId },
    });

    // Fixed assertions - the viewer role's capability is what's checked, not the role itself
    expect(response.status()).toBe(200);
    expect(Array.isArray(body.items)).toBe(true);

    return [response, body];
  }
}
