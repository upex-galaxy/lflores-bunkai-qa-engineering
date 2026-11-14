/**
 * KATA Architecture - Shared Auth Test Helpers
 *
 * Small, agnostic helpers for test-level identity switching that don't
 * belong on a KATA component (not an HTTP call itself, just fixture-level
 * bookkeeping). Centralizes logic needed by any test authenticating as more
 * than one identity in the same run (DRY principle).
 */

import type { ApiFixture } from '@ApiFixture';
import type { IdentityRole, IdentityState } from '@data/types';

import { existsSync, readFileSync } from 'node:fs';
import { config } from '@variables';

// ============================================
// Cached identities (ADR-0029)
// ============================================

function readIdentity(role: IdentityRole): IdentityState | null {
  const path = config.auth.identityStatePath(role);
  if (!existsSync(path)) { return null; }
  return JSON.parse(readFileSync(path, 'utf-8')) as IdentityState;
}

/**
 * False ONLY when `api-setup` cached this role as unprovisioned for the
 * current API URL (no credentials for the current TEST_ENV). Use it in a skip
 * pre-check before `useIdentity` for optional roles. Every other case (no
 * cache file, cache minted for another API URL, provisioned) returns true, so
 * `useIdentity` raises its explicit error instead of the spec skipping
 * silently.
 */
export function isIdentityProvisioned(role: IdentityRole): boolean {
  const identity = readIdentity(role);
  return !(identity && identity.apiUrl === config.apiUrl && identity.provisioned === false);
}

/**
 * Switch the actor of every API component to a cached identity. No network
 * call: `api-setup` already signed the role in once for the whole run.
 *
 * Cookies are opt-in, never ambient: the request context's cookies are always
 * cleared first, then the role's session cookies are loaded only when
 * `withSession` is set (cookie-only routes, PAT minting). An "unauthenticated"
 * assertion therefore never passes on a leftover cookie.
 *
 * Fails fast when the cache was minted for another API URL, or when
 * `withSession` is set and the cached session expires within 5 minutes (or
 * its expiry is missing or unparseable).
 *
 * @param api - The ApiFixture instance
 * @param role - The identity to act as
 * @param options - Switch options
 * @param options.withSession - Also load the role's session cookies
 */
export async function useIdentity(
  api: ApiFixture,
  role: IdentityRole,
  options: { withSession?: boolean } = {},
): Promise<void> {
  const { withSession = false } = options;
  const identity = readIdentity(role);
  if (!identity) { throw new Error(`[useIdentity] No cached identity for "${role}". Run the api-setup project first.`); }
  if (identity.apiUrl !== config.apiUrl) { throw new Error(`[useIdentity] Cached identity "${role}" was minted for ${identity.apiUrl}, current target is ${config.apiUrl}. Rerun the api-setup project.`); }
  if (!identity.provisioned) { throw new Error(`[useIdentity] Identity "${role}" is not provisioned: ${identity.reason}. Guard with isIdentityProvisioned().`); }
  // PAT-only calls skip the expiry check: the setup PAT lives 1 day, longer
  // than any run. 5-minute margin: Supabase refreshes ~90 s before expiry and
  // rotates the refresh token, which this cache never sees. A missing or
  // unparseable expiry counts as expired.
  const sessionExpiresAtMs = Date.parse(identity.sessionExpiresAt);
  if (withSession && (Number.isNaN(sessionExpiresAtMs) || Date.now() >= sessionExpiresAtMs - 5 * 60_000)) { throw new Error(`[useIdentity] Cached session for "${role}" expired at ${identity.sessionExpiresAt}. Rerun the api-setup project.`); }

  api.setAuthToken(identity.token);
  await api.request.clearCookies();
  if (withSession) { await api.request.addCookies(identity.cookies); }
}
