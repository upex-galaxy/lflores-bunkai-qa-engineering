/**
 * KATA Architecture - Layer 3: Tokens API Component
 *
 * API component for personal-access-token (PAT) lifecycle operations, and the
 * non-regression guards BK-497 introduced around them: PATs cannot mint or
 * revoke other PATs (`cookie-only` channel lift on the two mutation routes),
 * GET stays Bearer-accessible (positive control, not swept into the lift),
 * and identity resolution runs — and can reject with 401 — before any
 * `cookie-only` posture check does.
 *
 * ATCs follow flow-based design: each ATC is an ACTION + VERIFICATION,
 * not a simple POST/GET/DELETE. See atc/BK-552-*.md and siblings for the
 * full contracts (fixed vs test-level assertion split).
 *
 * Endpoints:
 * - POST /api/v1/tokens - Issue a personal access token (session-authenticated only)
 * - GET /api/v1/tokens - List the caller's tokens (Bearer OR cookie, no capability check)
 * - DELETE /api/v1/tokens/{id} - Revoke a personal access token (session-authenticated only)
 * - DELETE /api/v1/tokens/{id} responds 204 No Content, so `revokeToken` types its tuple's second element `void`, not a body.
 */

import type { APIResponse } from '@playwright/test';
import type { CreateTokenBody, CreateTokenResponse, ErrorEnvelope, ListTokensResponse } from '@schemas/tokens.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { INVALID_BEARER_TOKEN } from '@data/constants';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

// Re-export types for consumers that import from TokensApi
export type { CreateTokenBody, CreateTokenResponse, ErrorEnvelope, ListTokensResponse, TokenSummary } from '@schemas/tokens.types';

// ============================================
// Tokens API Component
// ============================================

export class TokensApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Helper: Raw POST /api/v1/tokens wrapper — issues a PAT under whatever
   * auth channel `this.authToken`/cookie jar is currently set to.
   *
   * Read/write primitive shared by `mintPatWithScopes` (cookie-only,
   * precondition use) and BK-545's embedded issue step (session-cookie,
   * ACTION use). Not an ATC on its own — it carries no fixed assertions;
   * callers own their own assertions.
   *
   * @param body - Token name, scopes, optional workspace binding/TTL
   * @returns Tuple with response, the issued token, and sent payload
   */
  @step
  async issueToken(body: CreateTokenBody): Promise<[APIResponse, CreateTokenResponse, CreateTokenBody]> {
    return this.apiPOST<CreateTokenResponse, CreateTokenBody>('/tokens', body);
  }

  /**
   * Helper: Raw GET /api/v1/tokens wrapper — lists the caller's own tokens.
   *
   * Reused as the test-level verification step for BK-552/BK-553's
   * "no row created" / "target unchanged" assertions, and as BK-545's
   * embedded list step. Not an ATC on its own.
   *
   * @returns Tuple with response and the token list
   */
  @step
  async listTokens(): Promise<[APIResponse, ListTokensResponse]> {
    return this.apiGET<ListTokensResponse>('/tokens');
  }

  /**
   * Helper: Raw DELETE /api/v1/tokens/{id} wrapper — revokes a token under
   * whatever auth channel is currently set.
   *
   * Reused by BK-545's embedded revoke step. Not an ATC on its own.
   *
   * @param tokenId - Target token id
   * @returns Tuple with response and the (empty) body
   */
  @step
  async revokeToken(tokenId: string): Promise<[APIResponse, void]> {
    return this.apiDELETE<void>(`/tokens/${tokenId}`);
  }

  /**
   * Helper: Mint a scoped/bound PAT as a test precondition.
   *
   * THE shared precondition helper for every TC in this plan that needs a
   * PAT with specific scopes and/or a workspace binding. Token issuance is
   * itself session-authenticated only (BK-552's own guard), so this helper
   * suspends any ambient Bearer token for the duration of the mint call —
   * mirroring `WorkspaceApi.postActiveWorkspace`'s suspend/restore pattern —
   * then restores it. Requires a session cookie already present in the
   * shared `APIRequestContext` (established by a prior
   * `api.auth.authenticateSuccessfully()` call earlier in the same test).
   *
   * @param overrides - Fields to override on the default token body (scopes
   *   defaults to `['atc:read']`, name defaults to a generated test id)
   * @returns The issued token (id, raw token, scopes, workspace binding, ...)
   */
  @step
  async mintPatWithScopes(overrides: Partial<CreateTokenBody> = {}): Promise<CreateTokenResponse> {
    const body: CreateTokenBody = {
      name: this.data.createTestId('pat'),
      scopes: ['atc:read'],
      ...overrides,
    };

    const savedToken = this.authToken;
    this.clearAuthToken();
    try {
      const [, respBody] = await this.issueToken(body);
      return respBody;
    }
    finally {
      if (savedToken) { this.setAuthToken(savedToken); }
    }
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: PAT-authenticated POST to the token-issuance route - expects rejection (403)
   *
   * Complete flow:
   * 1. POST a new-token body to /api/v1/tokens using a PAT (Bearer) as auth (ACTION)
   * 2. Validate the request is rejected with the verbatim channel-guard message (fixed assertions)
   *
   * The follow-up "was a row actually created?" check (GET /api/v1/tokens) is a
   * test-level assertion — it composes a second endpoint and belongs in the test file.
   *
   * @param overrides - Fields to override on the attempted token body
   * @returns Tuple with response, error envelope, and sent payload
   */
  @atc('BK-552')
  async rejectPatPostTokenIssuance(
    overrides?: Partial<CreateTokenBody>,
  ): Promise<[APIResponse, ErrorEnvelope, CreateTokenBody]> {
    const body: CreateTokenBody = {
      name: this.data.createTestId('pat-attempt'),
      scopes: ['atc:read'],
      ...overrides,
    };
    const [response, respBody, sentPayload] = await this.apiPOST<ErrorEnvelope, CreateTokenBody>('/tokens', body);

    // Fixed assertions - validates the channel-based rejection and its verbatim message
    expect(response.status()).toBe(403);
    expect(respBody.error.message).toBe('Personal access tokens cannot issue tokens. Use a browser session.');

    return [response, respBody, sentPayload];
  }

  /**
   * ATC: PAT-authenticated DELETE to the token-revocation route - expects rejection (403)
   *
   * Complete flow:
   * 1. DELETE a target token using a PAT (Bearer) as auth (ACTION)
   * 2. Validate the request is rejected with the verbatim channel-guard message (fixed assertions)
   *
   * The follow-up "did the target token stay unrevoked?" check (GET /api/v1/tokens) is a
   * test-level assertion — it composes a second endpoint and belongs in the test file.
   *
   * @param targetTokenId - A different token's id than the acting PAT
   * @returns Tuple with response and error envelope
   */
  @atc('BK-553')
  async rejectPatDeleteTokenRevocation(
    targetTokenId: string,
  ): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.apiDELETE<ErrorEnvelope>(`/tokens/${targetTokenId}`);

    // Fixed assertions - validates the channel-based rejection and its verbatim message
    expect(response.status()).toBe(403);
    expect(body.error.message).toBe('Personal access tokens cannot revoke tokens. Use a browser session.');

    return [response, body];
  }

  /**
   * ATC: PAT-authenticated GET to the token-listing route - expects success (200)
   *
   * Complete flow:
   * 1. GET /api/v1/tokens using a PAT (Bearer) as auth (ACTION)
   * 2. Validate the caller's own tokens are returned (fixed assertions)
   *
   * Positive control proving GET was NOT swept into the `cookie-only` lift — the
   * single call is the entire scope of this TC, no test-level composition needed.
   *
   * @returns Tuple with response and the token list
   */
  @atc('BK-543')
  async allowPatGetTokenListing(): Promise<[APIResponse, ListTokensResponse]> {
    const [response, body] = await this.apiGET<ListTokensResponse>('/tokens');

    // Fixed assertions - validates the listing succeeded over Bearer auth
    expect(response.status()).toBe(200);
    expect(Array.isArray(body.tokens)).toBe(true);

    return [response, body];
  }

  /**
   * ATC: Session-authenticated issue -> list -> revoke chain - expects success (201/200/204)
   *
   * Complete flow:
   * 1. POST a new token using the session cookie (ACTION 1)
   * 2. GET the token list, confirming the issued token appears (ACTION 2 / VERIFICATION)
   * 3. DELETE the issued token (ACTION 3)
   *
   * Embeds 3 `@step` helper calls (issueToken, listTokens, revokeToken) — NOT other
   * `@atc` methods, so this does not violate the ATC-calls-ATC rule. The TC's own
   * identity is the entire chain succeeding under cookie-only auth (single Jira Test
   * issue, single Gherkin scenario with 3 When/Then pairs), not 3 independent facts —
   * splitting further would fragment one TMS-approved TC into ATCs it was never
   * designed as. Precondition contract: `this.authToken` must already be `null`
   * (cookie-only) when this ATC runs — enforced by the calling test.
   *
   * @param body - Token name and scopes for the issued token
   * @returns Tuple with the issue, list, and revoke responses
   */
  @atc('BK-545')
  async allowSessionAuthenticatedTokenLifecycle(
    body: CreateTokenBody,
  ): Promise<[APIResponse, APIResponse, APIResponse]> {
    // ACTION 1: issue
    const [issueResponse, issueBody] = await this.issueToken(body);
    expect(issueResponse.status()).toBe(201);
    expect(issueBody.id).toBeDefined();

    // ACTION 2: list (VERIFICATION that the issued token appears)
    const [listResponse, listBody] = await this.listTokens();
    expect(listResponse.status()).toBe(200);
    expect(listBody.tokens.some(t => t.id === issueBody.id)).toBe(true);

    // ACTION 3: revoke
    const [revokeResponse] = await this.revokeToken(issueBody.id);
    expect(revokeResponse.status()).toBe(204);

    return [issueResponse, listResponse, revokeResponse];
  }

  /**
   * ATC: Invalid Bearer token before the cookie-only posture check runs - expects rejection (401)
   *
   * Complete flow:
   * 1. POST to /api/v1/tokens using a syntactically-invalid Bearer token (ACTION)
   * 2. Validate the request is rejected at 401 — NOT 403 — with the verbatim
   *    identity-resolution message (fixed assertions)
   *
   * Error-Guessing-derived TC (not AC-derived): proves `resolveIdentity` runs and
   * fails BEFORE the `cookie-only` posture check would otherwise answer 403.
   *
   * @param invalidToken - Override for the invalid Bearer token (defaults to the shared constant)
   * @returns Tuple with response and error envelope
   */
  @atc('BK-546')
  async rejectInvalidBearerBeforePostureCheck(
    invalidToken?: string,
  ): Promise<[APIResponse, ErrorEnvelope]> {
    this.setAuthToken(invalidToken ?? INVALID_BEARER_TOKEN);

    const [response, body] = await this.apiPOST<ErrorEnvelope, CreateTokenBody>('/tokens', {
      name: this.data.createTestId('pat-attempt'),
      scopes: ['atc:read'],
    });

    // Fixed assertions - validates identity resolution fails before the posture check
    expect(response.status()).toBe(401);
    expect(body.error.message).toBe('Invalid token.');

    return [response, body];
  }

  /**
   * ATC: Session-authenticated issue with an empty scopes array - expects rejection (422)
   *
   * Complete flow:
   * 1. POST a new-token body with `scopes: []` using the session cookie (ACTION)
   * 2. Validate the request is rejected at the validation layer, before a row
   *    is ever created (fixed assertions)
   *
   * BK-499 AC2 (BVA-derived): a PAT with zero scopes could authenticate but
   * pass every capability gate trivially, so issuance itself refuses an empty
   * array — this is the lower boundary of the scopes array, distinct from the
   * "at least one scope" happy path already covered by BK-671/BK-545.
   *
   * @param overrides - Fields to override on the attempted token body
   * @returns Tuple with response, error envelope, and sent payload
   */
  @atc('BK-672')
  async rejectZeroScopeTokenIssuance(
    overrides?: Partial<CreateTokenBody>,
  ): Promise<[APIResponse, ErrorEnvelope, CreateTokenBody]> {
    const body: CreateTokenBody = {
      name: this.data.createTestId('pat-zero-scope'),
      scopes: [],
      ...overrides,
    };

    // authenticateSuccessfully() leaves an ambient Bearer PAT set (BK-166
    // coexistence) alongside the session cookie — suspend it so this request
    // actually exercises the cookie-only channel, mirroring mintPatWithScopes.
    const savedToken = this.authToken;
    this.clearAuthToken();
    try {
      const [response, respBody, sentPayload] = await this.apiPOST<ErrorEnvelope, CreateTokenBody>('/tokens', body);

      // Fixed assertion - validates zero-scope issuance is rejected with a 422
      expect(response.status()).toBe(422);

      return [response, respBody, sentPayload];
    }
    finally {
      if (savedToken) { this.setAuthToken(savedToken); }
    }
  }
}
