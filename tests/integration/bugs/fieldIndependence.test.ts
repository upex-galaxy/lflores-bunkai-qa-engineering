/**
 * KATA Architecture - Bug Field Independence Tests
 *
 * Tests that assignee and status changes on a bug are independent of each
 * other (BK-484): reassigning a closed bug leaves its status untouched, and
 * advancing a bug's status leaves its assignee untouched.
 *
 * Project: integration (depends on api-setup)
 */

import { QA_WORKSPACE_MEMBER_USER_ID, QA_WORKSPACE_MODULE_ID, QA_WORKSPACE_OWNER_USER_ID, QA_WORKSPACE_PROJECT_ID } from '@data/constants';
import { config, expect, test } from '@TestFixture';

/**
 * Fixed reference workspace — same QA workspace fixture as
 * assignBug.test.ts. See that file's header comment for provenance.
 */

test.describe('BK-264: Bug Field Independence API', { tag: ['@high'] }, () => {
  /**
   * ATC: BK-484, row 1 — reassigning a closed, assigned bug leaves its
   * status untouched.
   */
  test('BK-264: should keep status unchanged when reassigning a closed bug', async ({ api }) => {
    await api.auth.authenticateSuccessfully({ email: config.testUser.email, password: config.testUser.password });
    const [, filed] = await api.bugs.fileBugSuccessfully({
      project_id: QA_WORKSPACE_PROJECT_ID,
      module_id: QA_WORKSPACE_MODULE_ID,
      title: `BK-484 automated fixture bug (reassign) - ${Date.now()}`,
      severity: 'P3',
    });
    await api.bugs.assignBugToEligibleMember(filed.bug.id, { assignee_user_id: QA_WORKSPACE_MEMBER_USER_ID });
    await api.bugs.advanceStatusLegally(filed.bug.id, { status: 'in_progress' });
    await api.bugs.advanceStatusLegally(filed.bug.id, { status: 'resolved' });
    await api.bugs.advanceStatusLegally(filed.bug.id, { status: 'closed' });

    await api.bugs.keepAssigneeAndStatusIndependent(filed.bug.id, {
      kind: 'assign',
      payload: { assignee_user_id: QA_WORKSPACE_OWNER_USER_ID },
    });

    // Test-level assertion: the untouched field (status) is unaffected — composes a 2nd GET
    const [, after] = await api.bugs.getBugById(filed.bug.id);
    expect(after.bug.status).toBe('closed');
  });

  /**
   * ATC: BK-484, row 2 — advancing status leaves the assignee untouched.
   */
  test('BK-264: should keep assignee unchanged when advancing status', async ({ api }) => {
    await api.auth.authenticateSuccessfully({ email: config.testUser.email, password: config.testUser.password });
    const [, filed] = await api.bugs.fileBugSuccessfully({
      project_id: QA_WORKSPACE_PROJECT_ID,
      module_id: QA_WORKSPACE_MODULE_ID,
      title: `BK-484 automated fixture bug (status) - ${Date.now()}`,
      severity: 'P3',
    });
    await api.bugs.assignBugToEligibleMember(filed.bug.id, { assignee_user_id: QA_WORKSPACE_MEMBER_USER_ID });

    await api.bugs.keepAssigneeAndStatusIndependent(filed.bug.id, {
      kind: 'status',
      payload: { status: 'in_progress' },
    });

    // Test-level assertion: the untouched field (assignee) is unaffected — composes a 2nd GET
    const [, after] = await api.bugs.getBugById(filed.bug.id);
    expect(after.bug.assignee_user_id).toBe(QA_WORKSPACE_MEMBER_USER_ID);
  });
});
