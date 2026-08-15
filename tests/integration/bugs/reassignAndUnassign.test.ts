/**
 * KATA Architecture - Bug Reassign/Unassign Tests
 *
 * Tests for POST /bugs/{id}/assign given a bug that already has an
 * assignee: reassigning to a different eligible member (BK-483) and
 * clearing the assignee entirely (BK-485).
 *
 * Project: integration (depends on api-setup)
 */

import { config, expect, test } from '@TestFixture';

/**
 * Fixed reference workspace — same "BK-264 QA Sandbox" fixture as
 * assignBug.test.ts. See that file's header comment for provenance.
 */
const BK264_SANDBOX_PROJECT_ID = '2fee236f-1246-40c4-bfc4-d332287f9548'; // BK264 Defect Triage
const BK264_SANDBOX_MODULE_ID = '175f8a08-20b9-4c96-a21a-e02dcae2837e'; // Defect Triage Module
const BK264_SANDBOX_OWNER_USER_ID = '2742da39-e0ff-4f0c-a0a1-88dae804e14f'; // matches STAGING_USER_EMAIL
const BK264_SANDBOX_MEMBER2_USER_ID = 'a8548f64-1aa8-43b1-9a5b-c44b27c4782a'; // matches STAGING_MEMBER_EMAIL

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
      project_id: BK264_SANDBOX_PROJECT_ID,
      module_id: BK264_SANDBOX_MODULE_ID,
      title: `BK-483 automated fixture bug - ${Date.now()}`,
      severity: 'P3',
    });
    await api.bugs.assignBugToEligibleMember(filed.bug.id, { assignee_user_id: BK264_SANDBOX_MEMBER2_USER_ID });

    await api.bugs.reassignBugToDifferentMember(filed.bug.id, { assignee_user_id: BK264_SANDBOX_OWNER_USER_ID });

    // Test-level assertion: the previous assignee is no longer set, persisted on re-read
    const [, after] = await api.bugs.getBugById(filed.bug.id);
    expect(after.bug.assignee_user_id).toBe(BK264_SANDBOX_OWNER_USER_ID);
    expect(after.bug.assignee_user_id).not.toBe(BK264_SANDBOX_MEMBER2_USER_ID);
  });

  /**
   * ATC: BK-485
   *
   * Precondition: bug already assigned to a member (Generate then assign).
   */
  test('BK-264: should clear the assignee when unassigning', async ({ api }) => {
    await api.auth.authenticateSuccessfully({ email: config.testUser.email, password: config.testUser.password });
    const [, filed] = await api.bugs.fileBugSuccessfully({
      project_id: BK264_SANDBOX_PROJECT_ID,
      module_id: BK264_SANDBOX_MODULE_ID,
      title: `BK-485 automated fixture bug - ${Date.now()}`,
      severity: 'P3',
    });
    await api.bugs.assignBugToEligibleMember(filed.bug.id, { assignee_user_id: BK264_SANDBOX_MEMBER2_USER_ID });

    await api.bugs.unassignBug(filed.bug.id);

    const [, after] = await api.bugs.getBugById(filed.bug.id);
    expect(after.bug.assignee_user_id).toBeNull();
  });
});
