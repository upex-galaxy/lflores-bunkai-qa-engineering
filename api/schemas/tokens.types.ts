/**
 * KATA Framework - Type Facade: Tokens Domain
 *
 * Wired to the real `POST/GET /api/v1/tokens` and `DELETE /api/v1/tokens/{id}`
 * endpoints (BK-497 — capability-posture enforcement on PAT issuance/revocation).
 *
 * Consumed by: tests/components/api/TokensApi.ts
 */

import type { components } from '@openapi';

// ============================================================================
// Endpoint Types - POST /api/v1/tokens (issue) / GET /api/v1/tokens (list)
// ============================================================================

/** Request payload for issuing a PAT: { name?, scopes, workspace_id?, expires_in_days? } */
export type CreateTokenBody = components['schemas']['CreateTokenBody'];

/** Response for a freshly-issued PAT — the raw `token` is shown exactly once. */
export type CreateTokenResponse = components['schemas']['CreateTokenResponse'];

/** Response for GET /api/v1/tokens — { tokens: TokenSummary[] }, RLS-scoped to the caller. */
export type ListTokensResponse = components['schemas']['ListTokensResponse'];

/** One token row in the caller's token list (no secret, `token_prefix` only). */
export type TokenSummary = components['schemas']['TokenSummary'];

// ============================================================================
// Shared
// ============================================================================

/** Canonical error envelope — 401 / 403 / 422 depending on the endpoint. */
export type ErrorEnvelope = components['schemas']['ErrorEnvelope'];
