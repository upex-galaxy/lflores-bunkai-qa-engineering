/**
 * KATA Architecture - Shared Auth Test Helpers
 *
 * Small, agnostic helpers for test-level identity switching that don't
 * belong on a KATA component (not an HTTP call itself, just fixture-level
 * bookkeeping). Centralizes logic needed by any test authenticating as more
 * than one identity in the same run (DRY principle).
 */

import type { LoginPayload } from '@api/AuthApi';
import type { ApiFixture } from '@ApiFixture';

// ============================================
// Helpers
// ============================================

/**
 * Authenticate + propagate the token to every API component.
 *
 * `api.auth.authenticateSuccessfully()` only sets the token on the AuthApi
 * instance itself (`ApiBase.setAuthToken` is a plain method, not virally
 * propagated). Sibling components (`api.capabilityGate`, `api.tokens`, etc.)
 * keep whichever token `api.setAuthToken()` last propagated — the owner's,
 * loaded from `.auth/api-state.json` at fixture setup — unless re-propagated
 * after every actor switch. Needed by any test that authenticates as more
 * than one identity.
 *
 * @param api - The ApiFixture instance
 * @param credentials - Email and password of the identity to switch to
 */
export async function authenticateAs(api: ApiFixture, credentials: LoginPayload): Promise<void> {
  await api.auth.authenticateSuccessfully(credentials);
  api.setAuthToken(api.auth.authToken!);
}
