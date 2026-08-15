/**
 * KATA Architecture - Bug Non-Disclosing 404 Tests
 *
 * Tests for POST /bugs/{id}/assign given a bug id that either doesn't exist
 * or belongs to a workspace the caller isn't a member of — both return the
 * identical 404/not_found shape (BK-488), never disclosing which case it was.
 *
 * Project: integration (depends on api-setup)
 */

import { config, test } from '@TestFixture';

/**
 * A real bugs row confirmed (read-only DB query, 2026-08-15) to belong to a
 * workspace unrelated to "BK-264 QA Sandbox" and to the caller's own
 * workspace — exercises the genuine foreign-workspace-id case, not a
 * substitute nonexistent id.
 */
const FOREIGN_WORKSPACE_BUG_ID = '8146efbe-3a17-4e8c-9379-52416bc6c90c';

test.describe('BK-264: Bug Non-Disclosing 404 API', { tag: ['@high'] }, () => {
  /**
   * ATC: BK-488 — parametrized (EP): a nonexistent id and a real
   * foreign-workspace id share the same 404/not_found outcome shape.
   */
  for (const { label, bugId } of [
    { label: 'nonexistent-id', bugId: crypto.randomUUID() },
    { label: 'foreign-workspace-id', bugId: FOREIGN_WORKSPACE_BUG_ID },
  ]) {
    test(`BK-264: should return a non-disclosing 404 given the bug does not exist or is outside the caller's workspace ("${label}")`, async ({ api }) => {
      await api.auth.authenticateSuccessfully({ email: config.testUser.email, password: config.testUser.password });

      await api.bugs.rejectNonDisclosingNotFound(bugId);
    });
  }
});
