/**
 * KATA Architecture - Bug Action Attribution Tests
 *
 * Tests for the audit-trail integrity invariant behind BK-487: every
 * bug-domain activity row's `actor` must reflect the identity that actually
 * made the call, never the bug's resulting assignee or a third party.
 * Verified for 2 actor/action pairs: owner performing assign, member
 * performing status-change. See:
 * .context/PBI/epics/EPIC-BK-31-bugs-defect-heatmap/test-specs/DT-T13-attribution-non-spoofable/spec.md
 *
 * Project: integration (depends on api-setup)
 */

import type { LoginPayload } from '@api/AuthApi';
import type { BugDetail } from '@api/BugsApi';
import type { ApiFixture } from '@ApiFixture';

import { config, expect, test } from '@TestFixture';

/**
 * Fixed reference workspace/project/module — same "BK-264 QA Sandbox" fixture
 * as statusTransitions.test.ts. See that file's header comment for provenance.
 */
const BK264_SANDBOX_PROJECT_ID = '2fee236f-1246-40c4-bfc4-d332287f9548'; // BK264 Defect Triage
const BK264_SANDBOX_MODULE_ID = '175f8a08-20b9-4c96-a21a-e02dcae2837e'; // Defect Triage Module
const BK264_SANDBOX_MEMBER2_USER_ID = 'a8548f64-1aa8-43b1-9a5b-c44b27c4782a'; // matches STAGING_MEMBER_EMAIL
const BK264_SANDBOX_WORKSPACE_ID = '6646f244-a28c-441e-8486-9af33bdb5c11'; // "BK-264 QA Sandbox" — live-verified 2026-08-20

/** Authenticate + propagate the token to every API component. See rejectViewerWrite.test.ts for why. */
async function authenticateAs(api: ApiFixture, credentials: LoginPayload): Promise<void> {
  await api.auth.authenticateSuccessfully(credentials);
  api.setAuthToken(api.auth.authToken!);
}

async function fileFreshBug(api: ApiFixture, label: string): Promise<BugDetail> {
  const [, filed] = await api.bugs.fileBugSuccessfully({
    project_id: BK264_SANDBOX_PROJECT_ID,
    module_id: BK264_SANDBOX_MODULE_ID,
    title: `${label} - ${Date.now()}`,
    severity: 'P3',
  });
  return filed.bug;
}

test.describe('BK-264: Bug Action Attribution', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-487 (row 1) — owner performs an assign; the activity row's actor
   * must be the owner, never the resulting assignee (member2).
   */
  test('BK-264: should attribute a bug assignment to the actor, not the resulting assignee', async ({ api }) => {
    await authenticateAs(api, { email: config.testUser.email, password: config.testUser.password });
    const [, meBody] = await api.auth.getCurrentUser();
    const ownerUserId = meBody.user.id;

    const bug = await fileFreshBug(api, 'BK-487 automated fixture bug (assign)');

    const [, matched] = await api.bugs.attributeActionToActualCaller({
      bugId: bug.id,
      workspaceId: BK264_SANDBOX_WORKSPACE_ID,
      action: { kind: 'assign', payload: { assignee_user_id: BK264_SANDBOX_MEMBER2_USER_ID } },
      expectedActorUserId: ownerUserId,
    });

    // Test-level assertion: actor is the caller, NOT the resulting assignee — proves non-spoofability
    expect(matched.payload.assignee_user_id).toBe(BK264_SANDBOX_MEMBER2_USER_ID);
    expect(matched.actor.user_id).not.toBe(matched.payload.assignee_user_id);
  });

  /**
   * ATC: BK-487 (row 2) — member performs a status change on a bug assigned
   * to them; the activity row's actor must be the member who made the call.
   */
  test('BK-264: should attribute a bug status change to the actor who performed it', async ({ api }) => {
    await authenticateAs(api, { email: config.testUser.email, password: config.testUser.password });
    const bug = await fileFreshBug(api, 'BK-487 automated fixture bug (status)');

    // Precondition: assign the bug to member2 before they act on it
    await api.bugs.assignBugToEligibleMember(bug.id, { assignee_user_id: BK264_SANDBOX_MEMBER2_USER_ID });

    await authenticateAs(api, { email: config.testMember.email, password: config.testMember.password });

    const [, matched] = await api.bugs.attributeActionToActualCaller({
      bugId: bug.id,
      workspaceId: BK264_SANDBOX_WORKSPACE_ID,
      action: { kind: 'status', payload: { status: 'in_progress' } },
      expectedActorUserId: BK264_SANDBOX_MEMBER2_USER_ID,
    });

    expect(matched.actor.user_id).toBe(BK264_SANDBOX_MEMBER2_USER_ID);
  });
});
