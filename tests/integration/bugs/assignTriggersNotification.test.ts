/**
 * KATA Architecture - Bug Assignment Notification Contract Test
 *
 * Tests that a bug's first assignment fans out a `bug.assigned`
 * notification (BK-489) — a documented integration contract for BK-212
 * (Notifications), which subscribes to this event.
 *
 * Project: integration (depends on api-setup)
 */

import { QA_WORKSPACE_ID, QA_WORKSPACE_MEMBER_USER_ID, QA_WORKSPACE_MODULE_ID, QA_WORKSPACE_PROJECT_ID } from '@data/constants';
import { expect, test } from '@TestFixture';
import { isIdentityProvisioned, useIdentity } from '@utils/auth';

/**
 * Fixed reference workspace — same QA workspace fixture as
 * assignBug.test.ts. See that file's header comment for provenance.
 */

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
    test.skip(!isIdentityProvisioned('member'), 'BK-264: config.testMember not provisioned for this environment');

    await useIdentity(api, 'owner');
    const [, filed] = await api.bugs.fileBugSuccessfully({
      project_id: QA_WORKSPACE_PROJECT_ID,
      module_id: QA_WORKSPACE_MODULE_ID,
      title: `BK-489 automated fixture bug - ${Date.now()}`,
      severity: 'P3',
    });

    await api.bugs.assignBugTriggersNotification(filed.bug.id, { assignee_user_id: QA_WORKSPACE_MEMBER_USER_ID });

    // Test-level assertion: the recipient's own inbox carries the fan-out row
    await useIdentity(api, 'member');
    const [, page] = await api.notifications.getNotifications(QA_WORKSPACE_ID);
    const row = page.items.find(item => item.entity_id === filed.bug.id && item.event_type === 'bug.assigned');

    expect(row).toBeDefined();
    expect(row?.entity_type).toBe('bug');
    expect((row?.payload as { assignee_user_id?: string, previous_assignee_user_id?: string | null })?.assignee_user_id).toBe(QA_WORKSPACE_MEMBER_USER_ID);
    expect((row?.payload as { assignee_user_id?: string, previous_assignee_user_id?: string | null })?.previous_assignee_user_id).toBeNull();
  });
});
