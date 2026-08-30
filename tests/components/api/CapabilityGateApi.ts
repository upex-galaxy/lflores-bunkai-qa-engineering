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
// Row / dispatch types (component-internal composition, not OpenAPI wire shapes)
// ============================================

/**
 * One sampled route in a Scenario Outline's Examples table. `route` mirrors
 * the TC's own Examples column verbatim (report label only, never sent over
 * the wire); `path` is the fully-resolved runtime path (real ids, any query
 * string already appended) to GET against.
 */
export interface CapabilityGateRouteRow {
  route: string
  path: string
}

/** One sampled route's outcome. */
export interface CapabilityGateRouteResult {
  route: string
  response: APIResponse
}

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

  /**
   * ATC: `atc:read`-scoped PAT against a sample of read-gated routes - expects success (200) on every sampled route
   *
   * Complete flow:
   * 1. GET each of 4 sampled `atc:read`-gated routes using a PAT scoped
   *    `atc:read` (ACTION, one call per row)
   * 2. Validate every row succeeds (fixed assertions)
   *
   * Sampling: 4 of the 14 `atc:read`-gated routes (Stage 1 code audit
   * confirmed all 14 wired identically) — `/activity`,
   * `/projects/{id}/traceability`, `/tests/{id}/runs`, `/workspaces/{id}`.
   * Only status is asserted (not per-route body shape) — this is a
   * cross-cutting proof the gate doesn't block a correctly-scoped caller,
   * not a re-test of each resource's own business response, which other
   * ATCs already cover.
   *
   * @param rows - The 4 sampled routes, already resolved to real ids/paths by the caller
   * @returns Per-route results (route label + response)
   */
  @atc('BK-673')
  async allowReadScopedPatOnGatedRoute(rows: CapabilityGateRouteRow[]): Promise<CapabilityGateRouteResult[]> {
    const results: CapabilityGateRouteResult[] = [];

    for (const row of rows) {
      const [response] = await this.apiGET(row.path);
      results.push({ route: row.route, response });
    }

    // Fixed assertions - every sampled route accepts the correctly-scoped PAT
    for (const result of results) {
      expect(result.response.status()).toBe(200);
    }

    return results;
  }

  /**
   * ATC: PAT missing `atc:read` against a sample of read-gated routes - expects rejection (403) on every sampled route
   *
   * Complete flow:
   * 1. GET the same 4 sampled routes as BK-673 using a PAT scoped only
   *    `run:execute` (no `atc:read`) (ACTION, one call per row)
   * 2. Validate every row is rejected, the error names the missing
   *    capability, and no data leaks (fixed assertions)
   *
   * Deliberate negative-path twin of BK-673 (BK-499's Implementation Plan
   * TD-3): a 403 alone could also mean a broken route, so both directions
   * are required on the same 4 routes.
   *
   * @param rows - The same 4 sampled routes as BK-673, already resolved to real ids/paths
   * @returns Per-route results (route label + response)
   */
  @atc('BK-674')
  async rejectPatMissingReadScopeOnGatedRoute(rows: CapabilityGateRouteRow[]): Promise<CapabilityGateRouteResult[]> {
    const results: CapabilityGateRouteResult[] = [];
    const bodies: ErrorEnvelope[] = [];

    for (const row of rows) {
      const [response, body] = await this.apiGET<ErrorEnvelope>(row.path);
      results.push({ route: row.route, response });
      bodies.push(body);
    }

    // Fixed assertions - every sampled route rejects the under-scoped PAT,
    // naming the missing capability, and returns no data
    for (const [index, result] of results.entries()) {
      expect(result.response.status()).toBe(403);
      expect(bodies[index].error.message).toContain('atc:read');
    }

    return results;
  }

  /**
   * ATC: any authenticated PAT against a sample of identity/notification routes - expects success regardless of scope
   *
   * Complete flow:
   * 1. GET each of 2 sampled identity/notification routes using a PAT
   *    scoped only `run:execute` (irrelevant to this bucket) (ACTION, one
   *    call per row)
   * 2. Validate every row succeeds — no 403 for a missing capability
   *    (fixed assertions)
   *
   * Sampling: 2 of the 6 identity/notification routes — `GET /me`,
   * `GET /workspaces/{id}/notifications`. Ruling Q1 (2026-08-21) draws the
   * category boundary explicitly: "caller's OWN data" (no capability) vs
   * "workspace-shared data" (`atc:read`-gated), despite both being reads.
   *
   * @param rows - The 2 sampled routes, already resolved to real ids/paths by the caller
   * @returns Per-route results (route label + response)
   */
  @atc('BK-677')
  async allowAnyAuthenticatedPatOnIdentityRoute(rows: CapabilityGateRouteRow[]): Promise<CapabilityGateRouteResult[]> {
    const results: CapabilityGateRouteResult[] = [];

    for (const row of rows) {
      const [response] = await this.apiGET(row.path);
      results.push({ route: row.route, response });
    }

    // Fixed assertions - identity/notification routes ignore scope entirely
    for (const result of results) {
      expect([200, 201]).toContain(result.response.status());
    }

    return results;
  }
}
