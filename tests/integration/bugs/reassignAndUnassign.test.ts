/**
 * KATA Architecture - Bug Reassign/Unassign Tests
 *
 * Tests for POST /bugs/{id}/assign given a bug that already has an
 * assignee: reassigning to a different eligible member (BK-483) and
 * clearing the assignee entirely (BK-485).
 *
 * Project: integration (depends on api-setup)
 */

import { QA_WORKSPACE_MEMBER_USER_ID, QA_WORKSPACE_MODULE_ID, QA_WORKSPACE_OWNER_USER_ID, QA_WORKSPACE_PROJECT_ID } from '@data/constants';
import { config, expect, test } from '@TestFixture';

/**
 * Fixed reference workspace — same QA workspace fixture as
 * assignBug.test.ts. See that file's header comment for provenance.
 */

test.describe('BK-264: Bug Reassign/Unassign API', { tag: ['@high'] }, () => {
  /**
   * ATC: BK-483
   *
   * Precondition: bug already assigned to the member (Generate then assign),
   * then reassigned to a different eligible member (the owner).
   */
  test('BK-264: should update the assignee when reassigning to a different eligible member', async ({ api }) => {
    await api.auth.authenticateSuccessfully({ email: config.testUser.email, password: config.testUser.password });
    const [, filed] = await api.bugs.fileBugSuccessfully({
      project_id: QA_WORKSPACE_PROJECT_ID,
      module_id: QA_WORKSPACE_MODULE_ID,
      title: `BK-483 automated fixture bug - ${Date.now()}`,
      severity: 'P3',
    });
    await api.bugs.assignBugToEligibleMember(filed.bug.id, { assignee_user_id: QA_WORKSPACE_MEMBER_USER_ID });

    await api.bugs.reassignBugToDifferentMember(filed.bug.id, { assignee_user_id: QA_WORKSPACE_OWNER_USER_ID });

    // Test-level assertion: the previous assignee is no longer set, persisted on re-read
    const [, after] = await api.bugs.getBugById(filed.bug.id);
    expect(after.bug.assignee_user_id).toBe(QA_WORKSPACE_OWNER_USER_ID);
    expect(after.bug.assignee_user_id).not.toBe(QA_WORKSPACE_MEMBER_USER_ID);
  });

  /**
   * ATC: BK-485
   *
   * Precondition: bug already assigned to a member (Generate then assign).
   */
  test('BK-264: should clear the assignee when unassigning', async ({ api }) => {
    await api.auth.authenticateSuccessfully({ email: config.testUser.email, password: config.testUser.password });
    const [, filed] = await api.bugs.fileBugSuccessfully({
      project_id: QA_WORKSPACE_PROJECT_ID,
      module_id: QA_WORKSPACE_MODULE_ID,
      title: `BK-485 automated fixture bug - ${Date.now()}`,
      severity: 'P3',
    });
    await api.bugs.assignBugToEligibleMember(filed.bug.id, { assignee_user_id: QA_WORKSPACE_MEMBER_USER_ID });

    await api.bugs.unassignBug(filed.bug.id);

    const [, after] = await api.bugs.getBugById(filed.bug.id);
    expect(after.bug.assignee_user_id).toBeNull();
  });
});
