/**
 * KATA Architecture - Test Data Types
 *
 * Types for test data generation and fixture state.
 * These are TEST-ONLY concepts — NOT API contract types.
 *
 * API contract types (request/response schemas) belong in:
 *   api/schemas/{domain}.types.ts → import from '@schemas/{domain}.types'
 */

// ============================================
// Generic Types
// ============================================

export interface TestUser {
  email: string
  password: string
  name: string
  firstName?: string
  lastName?: string
}

export interface TestCredentials {
  email: string
  password: string
}

// ============================================
// Auth/Fixture State Types
// ============================================

/**
 * Stored API state for test fixtures
 * Used by setup files and TestFixture for token propagation
 */
export interface ApiState {
  token: string
  tokenType: string
  expiresIn: number
  refreshToken: string | null
  source: 'ui-login' | 'api-login'
  createdAt: string
}

/** Test identities signed in once per run by `api-setup` (ADR-0029) */
export type IdentityRole = 'owner' | 'member' | 'viewer' | 'nonMember';

/** Cookie shape accepted by `APIRequestContext.addCookies` */
export interface IdentityCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite: 'Strict' | 'Lax' | 'None'
}

/**
 * Cached identity written by `api-setup` to `.auth/identities/<role>.json`
 * and read by `useIdentity` (no network). A role without credentials for
 * the current TEST_ENV is cached as `{ provisioned: false }`. `apiUrl` is the
 * API the identity was minted against; `sessionExpiresAt` (ISO) is when the
 * cached session cookies stop being valid.
 */
export type IdentityState
  = | { provisioned: false, role: IdentityRole, reason: string, apiUrl: string, createdAt: string }
    | (ApiState & { provisioned: true, role: IdentityRole, apiUrl: string, sessionExpiresAt: string, cookies: IdentityCookie[] });
