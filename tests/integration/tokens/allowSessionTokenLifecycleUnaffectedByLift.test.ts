/**
 * KATA Architecture - Session Token Lifecycle Integration Tests
 *
 * Non-regression guard proving session-cookie auth is entirely unaffected by
 * BK-497's `cookie-only` channel lift — issue -> list -> revoke, all three
 * token routes, in one chained flow.
 *
 * Project: integration (depends on api-setup)
 */

import { config, test } from '@TestFixture';

test.describe('BK-497: Session Token Lifecycle API', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-545
   *
   * Precondition: fresh login (session cookie) + Bearer explicitly cleared,
   * forcing the entire chain onto cookie-only auth.
   */
  test(
    'BK-497: should allow session-authenticated calls to all three token routes given the cookie-only lift',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      api.tokens.clearAuthToken();

      // ACTION + VERIFICATION: ATC embeds issue -> list -> revoke (201/200/204), and its own
      // cross-step consistency check (revoked id === issued id) — no test-level composition needed
      await api.tokens.allowSessionAuthenticatedTokenLifecycle({
        name: api.data.createTestId('pat-session-lifecycle'),
        scopes: ['atc:read'],
      });
    },
  );
});
