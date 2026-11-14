/**
 * KATA Architecture - Bug Assignment Authorization Tests
 *
 * Tests for the defect-triage write endpoints' authorization boundary
 * (POST /bugs/{id}/assign, POST /bugs/{id}/status). Validates that an
 * active Viewer-role member — a member without write access — is rejected
 * on both, and the bug is left unchanged.
 *
 * Project: integration (depends on api-setup)
 */

import type { BugWriteAction } from '@api/BugsApi';

import { QA_WORKSPACE_MODULE_ID, QA_WORKSPACE_OWNER_USER_ID, QA_WORKSPACE_PROJECT_ID } from '@data/constants';
import { expect, test } from '@TestFixture';
import { isIdentityProvisioned, useIdentity } from '@utils/auth';

/**
 * Fixed reference workspace — same QA workspace fixture as
 * assignBug.test.ts. See that file's header comment for provenance.
 */

const WRITE_ACTIONS: Array<{ label: string, action: () => BugWriteAction }> = [
  { label: 'assign', action: () => ({ kind: 'assign', payload: { assignee_user_id: QA_WORKSPACE_OWNER_USER_ID } }) },
  { label: 'status-change', action: () => ({ kind: 'status', payload: { status: 'in_progress' } }) },
];

test.describe('BK-264: Bug Write Authorization API', { tag: ['@high'] }, () => {
  for (const { label, action } of WRITE_ACTIONS) {
    /**
     * ATC: BK-486
     *
     * Precondition: cached owner identity (the QA workspace owner, `useIdentity`) (Discover
     * pattern) + Generate a fresh open bug via POST /bugs, then switch to
     * the Viewer identity (Discover pattern — provisioned this session,
     * config.testViewer) for the rejected action.
     */
    test(
      `BK-264: should reject a write action when the actor is Viewer-role given action is "${label}"`,
      async ({ api }) => {
        test.skip(!isIdentityProvisioned('viewer'), 'BK-264: config.testViewer not provisioned for this environment');

        // Precondition: authenticate as the QA workspace owner to generate the target bug
        await useIdentity(api, 'owner');
        const [, filed] = await api.bugs.fileBugSuccessfully({
          project_id: QA_WORKSPACE_PROJECT_ID,
          module_id: QA_WORKSPACE_MODULE_ID,
          title: `BK-486 automated fixture bug (${label}) - ${Date.now()}`,
          severity: 'P3',
        });

        // Precondition: switch to the Viewer-role actor (no write access)
        await useIdentity(api, 'viewer');

        // ACTION + fixed assertions live inside the ATC
        await api.bugs.rejectWriteActionForViewer(filed.bug.id, action());

        // Test-level assertion: the bug is unchanged by the rejected request.
        // Viewers can read (any active workspace role may GET a bug), so no
        // re-authentication is needed for this follow-up check.
        const [, after] = await api.bugs.getBugById(filed.bug.id);
        expect(after.bug.status).toBe('open');
        expect(after.bug.assignee_user_id).toBeNull();
      },
    );
  }
});
