/**
 * KATA Architecture - Bug Field Independence Tests
 *
 * Tests that assignee and status changes on a bug are independent of each
 * other (BK-484): reassigning a closed bug leaves its status untouched, and
 * advancing a bug's status leaves its assignee untouched.
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

test.describe('BK-264: Bug Field Independence API', { tag: ['@high'] }, () => {
  /**
   * ATC: BK-484, row 1 — reassigning a closed, assigned bug leaves its
   * status untouched.
   */
  test('BK-264: should keep status unchanged when reassigning a closed bug', async ({ api }) => {
    await api.auth.authenticateSuccessfully({ email: config.testUser.email, password: config.testUser.password });
    const [, filed] = await api.bugs.fileBugSuccessfully({
      project_id: BK264_SANDBOX_PROJECT_ID,
      module_id: BK264_SANDBOX_MODULE_ID,
      title: `BK-484 automated fixture bug (reassign) - ${Date.now()}`,
      severity: 'P3',
    });
    await api.bugs.assignBugToEligibleMember(filed.bug.id, { assignee_user_id: BK264_SANDBOX_MEMBER2_USER_ID });
    await api.bugs.advanceStatusLegally(filed.bug.id, { status: 'in_progress' });
    await api.bugs.advanceStatusLegally(filed.bug.id, { status: 'resolved' });
    await api.bugs.advanceStatusLegally(filed.bug.id, { status: 'closed' });

    await api.bugs.keepAssigneeAndStatusIndependent(filed.bug.id, {
      kind: 'assign',
      payload: { assignee_user_id: BK264_SANDBOX_OWNER_USER_ID },
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
      project_id: BK264_SANDBOX_PROJECT_ID,
      module_id: BK264_SANDBOX_MODULE_ID,
      title: `BK-484 automated fixture bug (status) - ${Date.now()}`,
      severity: 'P3',
    });
    await api.bugs.assignBugToEligibleMember(filed.bug.id, { assignee_user_id: BK264_SANDBOX_MEMBER2_USER_ID });

    await api.bugs.keepAssigneeAndStatusIndependent(filed.bug.id, {
      kind: 'status',
      payload: { status: 'in_progress' },
    });

    // Test-level assertion: the untouched field (assignee) is unaffected — composes a 2nd GET
    const [, after] = await api.bugs.getBugById(filed.bug.id);
    expect(after.bug.assignee_user_id).toBe(BK264_SANDBOX_MEMBER2_USER_ID);
  });
});
