/**
 * KATA Architecture - User Session Integration Tests
 *
 * Tests for authenticated user session via API.
 * Validates that token propagation works correctly.
 *
 * Project: integration (depends on api-setup)
 */

import { request as apiRequest } from '@playwright/test';
import { config, expect, test } from '@TestFixture';

test.describe('BK-166: User Session API', { tag: ['@critical'] }, () => {
  /**
   * Validates that the auth token is automatically loaded from api-state.json
   * and can be used to make authenticated API calls.
   */
  test('BK-166: should get current user with valid token', async ({ api }) => {
    // The token is automatically loaded from api-state.json by ApiFixture
    // Use helper (not ATC) — this is a read-only verification
    const [response, userData] = await api.auth.getCurrentUser();

    // Test-level assertions (UPEX Dojo format)
    expect(response.status()).toBe(200);
    expect(userData.user).toBeDefined();
    expect(userData.user.id).toBeDefined();
    expect(userData.user.email).toBeDefined();
  });

  /**
   * Validates that unauthenticated requests are rejected.
   *
   * Bunkai's `smoke` project sets `storageState` (session cookie from
   * `ui-setup`) at the project level, and `request.newContext()` inherits
   * it by default even outside a `page` context. Bearer PAT + session
   * cookie coexist (BK-166), so `api.clearAuthToken()` alone still leaves
   * the request cookie-authenticated. An explicit empty `storageState` is
   * required to actually reach an unauthenticated state.
   */
  test('BK-166: should fail without token', async () => {
    // baseURL + a leading-slash path resolves as origin-absolute (drops
    // the /api/v1 prefix per WHATWG URL rules) — pass the full URL instead.
    const anonymous = await apiRequest.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const response = await anonymous.get(`${config.apiUrl}${config.auth.meEndpoint}`);

      // Test-level assertions — no session should exist
      expect(response.status()).toBe(401);
      expect(response.ok()).toBe(false);
    }
    finally {
      await anonymous.dispose();
    }
  });

  /**
   * Validates that we can re-authenticate and get a new token.
   * This tests the runtime token refresh capability.
   */
  test('BK-166: should be able to re-authenticate', async ({ api }) => {
    // Clear existing token
    api.clearAuthToken();

    // Re-authenticate using the ATC (UPEX Dojo uses 'email' field)
    const credentials = {
      email: config.testUser.email,
      password: config.testUser.password,
    };

    const [response, tokenData] = await api.auth.authenticateSuccessfully(credentials);

    // Verify new token was obtained and set
    expect(response.status()).toBe(200);
    expect(tokenData.pat.token).toBeDefined();
  });
});
