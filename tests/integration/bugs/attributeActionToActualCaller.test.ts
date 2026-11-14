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

import type { BugDetail } from '@api/BugsApi';
import type { ApiFixture } from '@ApiFixture';

import { QA_WORKSPACE_ID, QA_WORKSPACE_MEMBER_USER_ID, QA_WORKSPACE_MODULE_ID, QA_WORKSPACE_PROJECT_ID } from '@data/constants';
import { expect, test } from '@TestFixture';
import { isIdentityProvisioned, useIdentity } from '@utils/auth';

/**
 * Fixed reference workspace/project/module — same QA workspace fixture
 * as statusTransitions.test.ts. See that file's header comment for provenance.
 */

async function fileFreshBug(api: ApiFixture, label: string): Promise<BugDetail> {
  const [, filed] = await api.bugs.fileBugSuccessfully({
    project_id: QA_WORKSPACE_PROJECT_ID,
    module_id: QA_WORKSPACE_MODULE_ID,
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
    await useIdentity(api, 'owner');
    const [, meBody] = await api.auth.getCurrentUser();
    const ownerUserId = meBody.user.id;

    const bug = await fileFreshBug(api, 'BK-487 automated fixture bug (assign)');

    const [, matched] = await api.bugs.attributeActionToActualCaller({
      bugId: bug.id,
      workspaceId: QA_WORKSPACE_ID,
      action: { kind: 'assign', payload: { assignee_user_id: QA_WORKSPACE_MEMBER_USER_ID } },
      expectedActorUserId: ownerUserId,
    });

    // Test-level assertion: actor is the caller, NOT the resulting assignee — proves non-spoofability
    expect(matched.payload.assignee_user_id).toBe(QA_WORKSPACE_MEMBER_USER_ID);
    expect(matched.actor.user_id).not.toBe(matched.payload.assignee_user_id);
  });

  /**
   * ATC: BK-487 (row 2) — member performs a status change on a bug assigned
   * to them; the activity row's actor must be the member who made the call.
   */
  test('BK-264: should attribute a bug status change to the actor who performed it', async ({ api }) => {
    test.skip(!isIdentityProvisioned('member'), 'BK-264: config.testMember not provisioned for this environment');

    await useIdentity(api, 'owner');
    const bug = await fileFreshBug(api, 'BK-487 automated fixture bug (status)');

    // Precondition: assign the bug to member2 before they act on it
    await api.bugs.assignBugToEligibleMember(bug.id, { assignee_user_id: QA_WORKSPACE_MEMBER_USER_ID });

    await useIdentity(api, 'member');

    const [, matched] = await api.bugs.attributeActionToActualCaller({
      bugId: bug.id,
      workspaceId: QA_WORKSPACE_ID,
      action: { kind: 'status', payload: { status: 'in_progress' } },
      expectedActorUserId: QA_WORKSPACE_MEMBER_USER_ID,
    });

    expect(matched.actor.user_id).toBe(QA_WORKSPACE_MEMBER_USER_ID);
  });
});
