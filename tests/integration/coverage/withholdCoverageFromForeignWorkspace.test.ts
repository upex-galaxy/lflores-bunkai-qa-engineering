/**
 * KATA Architecture - Workspace Coverage Non-Disclosure Integration Tests
 *
 * Regression guard for BK-259's workspace coverage endpoint: a caller who is
 * not an active member of the workspace they name gets the SAME zeroed 200 an
 * empty workspace returns, never real figures and never an answer that
 * confirms the workspace exists.
 *
 * Project: integration (depends on api-setup)
 */

import { randomUUID } from 'node:crypto';
import { WORKSPACE_NOT_MEMBER_ID } from '@data/constants';
import { test } from '@TestFixture';
import { isIdentityProvisioned, useIdentity } from '@utils/auth';

test.describe('BK-259: Workspace Coverage Non-Disclosure API', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-872
   *
   * Precondition: cached `member` identity (member of its own workspace, NOT of
   * `WORKSPACE_NOT_MEMBER_ID`). The reserved foreign workspace has real
   * projects and modules, so a leak would show up as a non-zero
   * `project_count` / `modules_total`.
   *
   * Note: the TC text says "forged cookie", but the route takes the workspace
   * from the path and ignores the active-workspace cookie. The forged value
   * the caller controls is the path id, which is what this test sends.
   */
  test(
    'BK-872: should disclose nothing given a forged workspace id pointing at a foreign workspace',
    async ({ api }) => {
      test.skip(!isIdentityProvisioned('member'), 'BK-872: needs a provisioned "member" identity for this environment');
      await useIdentity(api, 'member');

      // ACTION: read the coverage of a real workspace the caller does not belong
      // to - ATC handles fixed assertions (200 + empty-workspace shape)
      await api.coverage.withholdCoverageFromForeignWorkspace(WORKSPACE_NOT_MEMBER_ID);

      // Control: a workspace id that does not exist anywhere. The ATC asserts the
      // same 200 + empty shape for it, so a real foreign workspace and a
      // nonexistent one are proven indistinguishable (no existence echo) without
      // a second, redundant comparison here.
      await api.coverage.withholdCoverageFromForeignWorkspace(randomUUID());
    },
  );
});
