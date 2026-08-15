/**
 * KATA Architecture - Bug Assignment Rejection Tests
 *
 * Tests for POST /bugs/{id}/assign's target-eligibility validation:
 * rejecting a non-member target (BK-480) and a Viewer-role target (BK-481).
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
const BK264_SANDBOX_VIEWER_USER_ID = '23673d9a-4aac-46eb-ba63-c9d58a245458'; // matches STAGING_VIEWER_EMAIL

test.describe('BK-264: Bug Assignment Rejection API', { tag: ['@high'] }, () => {
  /**
   * ATC: BK-480
   *
   * Precondition: a random UUID is guaranteed to have no workspace_members
   * row in the sandbox workspace (Generate pattern — no real user needed,
   * the endpoint only checks membership, not user existence).
   */
  test('BK-264: should reject assignment given the target is not a workspace member', async ({ api }) => {
    await api.auth.authenticateSuccessfully({ email: config.testUser.email, password: config.testUser.password });
    const [, filed] = await api.bugs.fileBugSuccessfully({
      project_id: BK264_SANDBOX_PROJECT_ID,
      module_id: BK264_SANDBOX_MODULE_ID,
      title: `BK-480 automated fixture bug - ${Date.now()}`,
      severity: 'P3',
    });

    await api.bugs.rejectAssignToNonMember(filed.bug.id, crypto.randomUUID());

    const [, after] = await api.bugs.getBugById(filed.bug.id);
    expect(after.bug.assignee_user_id).toBeNull();
  });

  /**
   * ATC: BK-481
   *
   * Precondition: STAGING_VIEWER_EMAIL is an active viewer-role member of
   * the sandbox workspace (provisioned in a prior session).
   */
  test('BK-264: should reject assignment given the target is a Viewer-role member', async ({ api }) => {
    await api.auth.authenticateSuccessfully({ email: config.testUser.email, password: config.testUser.password });
    const [, filed] = await api.bugs.fileBugSuccessfully({
      project_id: BK264_SANDBOX_PROJECT_ID,
      module_id: BK264_SANDBOX_MODULE_ID,
      title: `BK-481 automated fixture bug - ${Date.now()}`,
      severity: 'P3',
    });

    await api.bugs.rejectAssignToViewer(filed.bug.id, BK264_SANDBOX_VIEWER_USER_ID);

    const [, after] = await api.bugs.getBugById(filed.bug.id);
    expect(after.bug.assignee_user_id).toBeNull();
  });
});
