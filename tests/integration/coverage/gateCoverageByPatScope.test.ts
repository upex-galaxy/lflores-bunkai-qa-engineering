/**
 * KATA Architecture - Workspace Coverage Scope Gate Integration Tests
 *
 * Regression guard for BK-259's workspace coverage endpoint: it is gated by
 * the `atc:read` capability, so a PAT holding `atc:read` reads it and a PAT
 * holding only `atc:write` is rejected (write does not substitute for read).
 * The gate itself is proven on other routes by BK-499; this proves the
 * coverage route declares it.
 *
 * Project: integration (depends on api-setup)
 */

import { expect, test } from '@TestFixture';
import { isIdentityProvisioned, useIdentity } from '@utils/auth';

test.describe('BK-259: Workspace Coverage Scope Gate API', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-873
   *
   * Precondition: cached `member` identity with a session (PAT minting is
   * cookie-only) + a workspace the member belongs to + two PATs, one scoped
   * `atc:read` and one scoped `atc:write` only. Both expire in 1 day (the API
   * minimum) and are revoked at the end, each revocation verified, so no token
   * stays live in the shared staging environment.
   */
  test(
    'BK-873: should gate the coverage endpoint by PAT scope',
    async ({ api }) => {
      test.skip(!isIdentityProvisioned('member'), 'BK-873: needs a provisioned "member" identity for this environment');
      await useIdentity(api, 'member', { withSession: true });

      const [, me] = await api.auth.getCurrentUser();
      test.skip(me.workspaces.length === 0, 'BK-873: test user needs at least one workspace membership');
      const workspaceId = me.workspaces[0].id;

      const mintedIds: string[] = [];
      const revokeFailures: string[] = [];

      try {
        // Both mints live inside the try so a failure on the second one still
        // revokes the first
        const readPat = await api.tokens.mintPatWithScopes({ scopes: ['atc:read'], expires_in_days: 1 });
        mintedIds.push(readPat.id);
        const writePat = await api.tokens.mintPatWithScopes({ scopes: ['atc:write'], expires_in_days: 1 });
        mintedIds.push(writePat.id);

        // ACTION: read the coverage under each PAT - ATC handles fixed assertions
        // (200 + coverage fields for atc:read, 403 naming atc:read for atc:write)
        await api.coverage.gateCoverageByPatScope({
          workspaceId,
          rows: [
            { scope: 'atc:read', token: readPat.token },
            { scope: 'atc:write', token: writePat.token },
          ],
        });
      }
      finally {
        // Revocation is session-authenticated only (BK-553): drop the ambient
        // Bearer so the session cookie is the only credential on the call.
        // Each token is revoked on its own and its status checked, so one
        // failure neither skips the other nor hides the assertion error above.
        api.tokens.clearAuthToken();
        for (const id of mintedIds) {
          try {
            const [response] = await api.tokens.revokeToken(id);
            if (response.status() !== 204) { revokeFailures.push(`${id}: HTTP ${response.status()}`); }
          }
          catch (error) {
            revokeFailures.push(`${id}: ${String(error)}`);
          }
        }
        if (revokeFailures.length > 0) { console.warn(`BK-873: PATs left live in staging: ${revokeFailures.join('; ')}`); }
      }

      // Reached only when the gate assertions passed: a failed cleanup then fails
      // the test instead of passing silently
      expect(revokeFailures, 'every minted PAT must be revoked').toEqual([]);
    },
  );
});
