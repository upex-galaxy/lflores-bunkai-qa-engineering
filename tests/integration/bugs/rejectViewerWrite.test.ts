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

import type { LoginPayload } from '@api/AuthApi';
import type { BugWriteAction } from '@api/BugsApi';
import type { ApiFixture } from '@ApiFixture';

import { config, expect, test } from '@TestFixture';

/**
 * Authenticate + propagate the token to every API component.
 *
 * api.auth.authenticateSuccessfully() only sets the token on the AuthApi
 * instance itself (ApiBase.setAuthToken is a plain method, not virally
 * propagated). Sibling components (api.bugs, etc.) keep whichever token
 * api.setAuthToken() last propagated — the owner's, loaded from
 * .auth/api-state.json at fixture setup — unless re-propagated after every
 * actor switch. Needed by any test that authenticates as more than one
 * identity (this file is the first).
 */
async function authenticateAs(api: ApiFixture, credentials: LoginPayload): Promise<void> {
  await api.auth.authenticateSuccessfully(credentials);
  api.setAuthToken(api.auth.authToken!);
}

/**
 * Fixed reference workspace — same "BK-264 QA Sandbox" fixture as
 * assignBug.test.ts. See that file's header comment for provenance.
 */
const BK264_SANDBOX_PROJECT_ID = '2fee236f-1246-40c4-bfc4-d332287f9548'; // BK264 Defect Triage
const BK264_SANDBOX_MODULE_ID = '175f8a08-20b9-4c96-a21a-e02dcae2837e'; // Defect Triage Module
const BK264_SANDBOX_OWNER_USER_ID = '2742da39-e0ff-4f0c-a0a1-88dae804e14f'; // matches STAGING_USER_EMAIL

const WRITE_ACTIONS: Array<{ label: string, action: () => BugWriteAction }> = [
  { label: 'assign', action: () => ({ kind: 'assign', payload: { assignee_user_id: BK264_SANDBOX_OWNER_USER_ID } }) },
  { label: 'status-change', action: () => ({ kind: 'status', payload: { status: 'in_progress' } }) },
];

test.describe('BK-264: Bug Write Authorization API', { tag: ['@high'] }, () => {
  for (const { label, action } of WRITE_ACTIONS) {
    /**
     * ATC: BK-486
     *
     * Precondition: fresh login as the sandbox workspace owner (Discover
     * pattern) + Generate a fresh open bug via POST /bugs, then switch to
     * the Viewer identity (Discover pattern — provisioned this session,
     * config.testViewer) for the rejected action.
     */
    test(
      `BK-264: should reject a write action when the actor is Viewer-role given action is "${label}"`,
      async ({ api }) => {
        // Precondition: authenticate as the sandbox workspace owner to generate the target bug
        await authenticateAs(api, { email: config.testUser.email, password: config.testUser.password });
        const [, filed] = await api.bugs.fileBugSuccessfully({
          project_id: BK264_SANDBOX_PROJECT_ID,
          module_id: BK264_SANDBOX_MODULE_ID,
          title: `BK-486 automated fixture bug (${label}) - ${Date.now()}`,
          severity: 'P3',
        });

        // Precondition: switch to the Viewer-role actor (no write access)
        await authenticateAs(api, { email: config.testViewer.email, password: config.testViewer.password });

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
