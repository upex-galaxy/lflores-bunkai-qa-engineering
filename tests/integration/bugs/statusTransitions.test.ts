/**
 * KATA Architecture - Bug Status Transition Tests
 *
 * Tests for the defect-triage status-lifecycle endpoint (POST /bugs/{id}/status):
 * legal forward transitions (BK-479), rejected skips (BK-478), and rejected
 * backward/same-status transitions (BK-482). Lifecycle order:
 * open -> in_progress -> resolved -> closed, one stage at a time.
 *
 * Project: integration (depends on api-setup)
 */

import type { LoginPayload } from '@api/AuthApi';
import type { BugDetail, BugStatusTransitionBody } from '@api/BugsApi';
import type { ApiFixture } from '@ApiFixture';

import { config, expect, test } from '@TestFixture';

/**
 * Fixed reference workspace — same "BK-264 QA Sandbox" fixture as
 * assignBug.test.ts. See that file's header comment for provenance.
 */
const BK264_SANDBOX_PROJECT_ID = '2fee236f-1246-40c4-bfc4-d332287f9548'; // BK264 Defect Triage
const BK264_SANDBOX_MODULE_ID = '175f8a08-20b9-4c96-a21a-e02dcae2837e'; // Defect Triage Module
const BK264_SANDBOX_MEMBER2_USER_ID = 'a8548f64-1aa8-43b1-9a5b-c44b27c4782a'; // matches STAGING_MEMBER_EMAIL

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

/** Walk a fresh "open" bug forward, one legal stage at a time, up to (not including) `target`. */
async function advanceTo(api: ApiFixture, bugId: string, target: 'in_progress' | 'resolved' | 'closed'): Promise<void> {
  const stages: BugStatusTransitionBody['status'][] = ['in_progress', 'resolved', 'closed'];
  for (const stage of stages) {
    await api.bugs.advanceStatusLegally(bugId, { status: stage });
    if (stage === target) { return; }
  }
}

test.describe('BK-264: Bug Status Transition API', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-479 (single test, not parametrized — the 3 Examples rows are a
   * sequential lifecycle chain on ONE bug, not independent partitions).
   */
  test('BK-264: should advance status through every legal forward transition', async ({ api }) => {
    await authenticateAs(api, { email: config.testUser.email, password: config.testUser.password });
    const bug = await fileFreshBug(api, 'BK-479 automated fixture bug');

    // Precondition: the bug's assignee performs rows 1-2 (open->in_progress, in_progress->resolved)
    await api.bugs.assignBugToEligibleMember(bug.id, { assignee_user_id: BK264_SANDBOX_MEMBER2_USER_ID });
    await authenticateAs(api, { email: config.testMember.email, password: config.testMember.password });
    await api.bugs.advanceStatusLegally(bug.id, { status: 'in_progress' });
    await api.bugs.advanceStatusLegally(bug.id, { status: 'resolved' });

    // Row 3: a non-assignee Member+ actor (the owner) can legally close it
    await authenticateAs(api, { email: config.testUser.email, password: config.testUser.password });
    await api.bugs.advanceStatusLegally(bug.id, { status: 'closed' });

    const [, after] = await api.bugs.getBugById(bug.id);
    expect(after.bug.status).toBe('closed');
  });

  /**
   * ATC: BK-478 — parametrized (EP): 3 independent skip combinations share
   * the same 422/status_transition_skipped outcome shape.
   */
  for (const { label, from, to } of [
    { label: 'open->resolved', from: undefined, to: 'resolved' as const },
    { label: 'open->closed', from: undefined, to: 'closed' as const },
    { label: 'in_progress->closed', from: 'in_progress' as const, to: 'closed' as const },
  ]) {
    test(`BK-264: should reject a status change that skips a lifecycle stage ("${label}")`, async ({ api }) => {
      await authenticateAs(api, { email: config.testUser.email, password: config.testUser.password });
      const bug = await fileFreshBug(api, `BK-478 automated fixture bug (${label})`);
      if (from) { await advanceTo(api, bug.id, from); }

      await api.bugs.rejectStatusSkip(bug.id, { status: to });

      const [, after] = await api.bugs.getBugById(bug.id);
      expect(after.bug.status).toBe(from ?? 'open');
    });
  }

  /**
   * ATC: BK-482 — parametrized (EP): 3 genuine-backward rows + 1 same-status
   * row all fold into the same 422/status_transition_backward outcome shape.
   */
  for (const { label, from, to } of [
    { label: 'resolved->open', from: 'resolved' as const, to: 'open' as const },
    { label: 'in_progress->open', from: 'in_progress' as const, to: 'open' as const },
    { label: 'closed->in_progress', from: 'closed' as const, to: 'in_progress' as const },
    { label: 'in_progress->in_progress (same-status)', from: 'in_progress' as const, to: 'in_progress' as const },
  ]) {
    test(`BK-264: should reject a status change that moves backward or repeats the current status ("${label}")`, async ({ api }) => {
      await authenticateAs(api, { email: config.testUser.email, password: config.testUser.password });
      const bug = await fileFreshBug(api, `BK-482 automated fixture bug (${label})`);
      await advanceTo(api, bug.id, from);

      await api.bugs.rejectStatusBackwardOrSame(bug.id, { status: to });

      const [, after] = await api.bugs.getBugById(bug.id);
      expect(after.bug.status).toBe(from);
    });
  }
});
