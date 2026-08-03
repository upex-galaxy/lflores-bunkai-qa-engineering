/**
 * KATA Framework - Type Facade: Auth Domain
 *
 * Wired to the real `/api/v1/auth/signin` and `/api/v1/me` endpoints.
 *
 * Consumed by: tests/components/api/AuthApi.ts
 */

import type { paths } from '@openapi';

// ============================================================================
// Endpoint Types - POST /api/v1/auth/signin
// ============================================================================

type SigninPath = paths['/api/v1/auth/signin']['post'];

/** Request payload for /auth/signin ({ email, password } + optional PAT-minting fields) */
export type LoginPayload = SigninPath['requestBody']['content']['application/json'];

/** { user, session: { access_token, refresh_token, expires_at, token_type }, pat: { token, ... }, warning } */
export type TokenResponse = SigninPath['responses']['200']['content']['application/json'];

/** Canonical error envelope: { error: { code, message, details?, request_id? } } */
export type AuthErrorResponse = SigninPath['responses']['401']['content']['application/json'];

// ============================================================================
// Endpoint Types - GET /api/v1/me
// ============================================================================

type MePath = paths['/api/v1/me']['get'];

/** { user, workspaces[], active_workspace_id, active_workspace_role, auth: { source, scopes } } */
export type UserInfoResponse = MePath['responses']['200']['content']['application/json'];
