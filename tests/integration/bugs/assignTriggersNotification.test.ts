/**
 * KATA Architecture - Bug Assignment Notification Contract Test
 *
 * Tests that a bug's first assignment fans out a `bug.assigned`
 * notification (BK-489) — a documented integration contract for BK-212
 * (Notifications), which subscribes to this event.
 *
 * Project: integration (depends on api-setup)
 */

import type { LoginPayload } from '@api/AuthApi';
import type { ApiFixture } from '@ApiFixture';

import { config, expect, test } from '@TestFixture';

/**
 * Fixed reference workspace — same "BK-264 QA Sandbox" fixture as
 * assignBug.test.ts. See that file's header comment for provenance.
 */
const BK264_SANDBOX_WORKSPACE_ID = '6646f244-a28c-441e-8486-9af33bdb5c11';
const BK264_SANDBOX_PROJECT_ID = '2fee236f-1246-40c4-bfc4-d332287f9548'; // BK264 Defect Triage
const BK264_SANDBOX_MODULE_ID = '175f8a08-20b9-4c96-a21a-e02dcae2837e'; // Defect Triage Module
const BK264_SANDBOX_MEMBER2_USER_ID = 'a8548f64-1aa8-43b1-9a5b-c44b27c4782a'; // matches STAGING_MEMBER_EMAIL

/** Authenticate + propagate the token to every API component. See rejectViewerWrite.test.ts for why. */
async function authenticateAs(api: ApiFixture, credentials: LoginPayload): Promise<void> {
  await api.auth.authenticateSuccessfully(credentials);
  api.setAuthToken(api.auth.authToken!);
}

test.describe('BK-264: Bug Assignment Notification Contract API', { tag: ['@medium'] }, () => {
  /**
   * ATC: BK-489
   *
   * Precondition: fresh open, unassigned bug (Generate) assigned to the
   * member identity for the first time. The recipient's own notification
   * inbox (GET /workspaces/{id}/notifications) is the only API-verifiable
   * proxy for the `notifications` row — reading it as the recipient, not
   * the actor, is what makes this a genuine fan-out check.
   */
  test('BK-264: should write a notifications row given a bug is assigned', async ({ api }) => {
    await authenticateAs(api, { email: config.testUser.email, password: config.testUser.password });
    const [, filed] = await api.bugs.fileBugSuccessfully({
      project_id: BK264_SANDBOX_PROJECT_ID,
      module_id: BK264_SANDBOX_MODULE_ID,
      title: `BK-489 automated fixture bug - ${Date.now()}`,
      severity: 'P3',
    });

    await api.bugs.assignBugTriggersNotification(filed.bug.id, { assignee_user_id: BK264_SANDBOX_MEMBER2_USER_ID });

    // Test-level assertion: the recipient's own inbox carries the fan-out row
    await authenticateAs(api, { email: config.testMember.email, password: config.testMember.password });
    const [, page] = await api.notifications.getNotifications(BK264_SANDBOX_WORKSPACE_ID);
    const row = page.items.find(item => item.entity_id === filed.bug.id && item.event_type === 'bug.assigned');

    expect(row).toBeDefined();
    expect(row?.entity_type).toBe('bug');
    expect((row?.payload as { assignee_user_id?: string, previous_assignee_user_id?: string | null })?.assignee_user_id).toBe(BK264_SANDBOX_MEMBER2_USER_ID);
    expect((row?.payload as { assignee_user_id?: string, previous_assignee_user_id?: string | null })?.previous_assignee_user_id).toBeNull();
  });
});
