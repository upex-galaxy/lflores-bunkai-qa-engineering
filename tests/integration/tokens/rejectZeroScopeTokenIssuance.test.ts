/**
 * KATA Architecture - Zero-Scope Token Issuance Integration Test
 *
 * BK-499 TC2 (Shift-Left Finding B): a token issuance request with `scopes: []`
 * must be rejected at the validation layer (422), not at a later capability
 * check — a zero-scope PAT would authenticate but trivially pass every gate.
 *
 * Project: integration (depends on api-setup)
 */

import { config, expect, test } from '@TestFixture';

test.describe('BK-499: Zero-Scope Token Issuance API', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-672
   *
   * Precondition: fresh login (session cookie only) — token issuance is
   * cookie-only, so no PAT is minted before this ACTION.
   */
  test(
    'BK-499: should reject token issuance given zero scopes requested',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });

      // ACTION: ATC handles fixed assertions — 422 validation rejection
      const [, , sentPayload] = await api.tokens.rejectZeroScopeTokenIssuance();

      // Test-level assertion: no token row was created for the attempted name
      const [, listBody] = await api.tokens.listTokens();
      expect(listBody.tokens.some(token => token.name === sentPayload.name)).toBe(false);
    },
  );
});
