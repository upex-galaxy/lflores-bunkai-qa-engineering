/**
 * KATA Architecture - Token Route Cookie-Only Posture Integration Tests
 *
 * Non-regression guards for BK-497's `cookie-only` channel lift on the two
 * token-mutation routes (POST/DELETE /api/v1/tokens*), the GET exception that
 * keeps token-listing Bearer-accessible, and the identity-resolution-before-
 * posture-check ordering on an invalid Bearer token.
 *
 * Project: integration (depends on api-setup)
 */

import { INVALID_BEARER_TOKEN } from '@data/constants';
import { config, expect, test } from '@TestFixture';

test.describe('BK-497: Token Route Cookie-Only Posture API', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-552
   *
   * Precondition: fresh login (session cookie) + mint any-scope PAT, set as
   * the ambient Bearer token for the acting request.
   */
  test(
    'BK-497: should reject a PAT-authenticated POST to the token-issuance route',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['atc:read'] });
      api.tokens.setAuthToken(pat.token);

      // ACTION: ATC handles fixed assertions — 403, verbatim channel-guard message
      const [, , sentPayload] = await api.tokens.rejectPatPostTokenIssuance();

      // Test-level assertion: no token row was created for the attempted name
      // (same PAT, GET is allowed for PATs — proves zero rows created)
      const [, listBody] = await api.tokens.listTokens();
      expect(listBody.tokens.some(token => token.name === sentPayload.name)).toBe(false);
    },
  );

  /**
   * ATC: BK-553
   *
   * Precondition: fresh login + mint a target PAT (to attempt revoking) +
   * mint a separate acting PAT (any scope), set as the ambient Bearer token.
   */
  test(
    'BK-497: should reject a PAT-authenticated DELETE to the token-revocation route',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      const targetPat = await api.tokens.mintPatWithScopes({ scopes: ['atc:read'] });
      const actingPat = await api.tokens.mintPatWithScopes({ scopes: ['atc:read'] });
      api.tokens.setAuthToken(actingPat.token);

      // ACTION: ATC handles fixed assertions — 403, verbatim channel-guard message
      await api.tokens.rejectPatDeleteTokenRevocation(targetPat.id);

      // Test-level assertion: the target token's revoked_at is still null
      const [, listBody] = await api.tokens.listTokens();
      const target = listBody.tokens.find(token => token.id === targetPat.id);
      expect(target?.revoked_at).toBeNull();
    },
  );

  /**
   * ATC: BK-543
   *
   * Precondition: fresh login + mint any-scope PAT, set as ambient Bearer.
   */
  test(
    'BK-497: should allow a PAT-authenticated GET to the token-listing route',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      const pat = await api.tokens.mintPatWithScopes({ scopes: ['atc:read'] });
      api.tokens.setAuthToken(pat.token);

      // ACTION + VERIFICATION: ATC handles fixed assertions — 200, tokens array
      // (positive control, proves GET was NOT swept into the cookie-only lift)
      await api.tokens.allowPatGetTokenListing();
    },
  );

  /**
   * ATC: BK-546
   *
   * Precondition: none — an invalid/malformed Bearer token IS the precondition.
   */
  test(
    'BK-497: should return 401 for an invalid Bearer token before the cookie-only posture check runs',
    async ({ api }) => {
      // ACTION: ATC handles fixed assertions — 401 (not 403), verbatim "Invalid token." message
      await api.tokens.rejectInvalidBearerBeforePostureCheck(INVALID_BEARER_TOKEN);
    },
  );
});
