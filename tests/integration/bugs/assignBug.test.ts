/**
 * KATA Architecture - Bug Assignment Integration Tests
 *
 * Tests for the defect-assignment endpoint (POST /bugs/{id}/assign).
 * Validates that a bug can be assigned to an eligible workspace member
 * (role "member" or "owner", active status).
 *
 * Project: integration (depends on api-setup)
 */

import { config, expect, test } from '@TestFixture';

/**
 * Fixed reference workspace where the BK-264 test fixtures (owner + member +
 * project + module) were seeded during a prior /sprint-testing session,
 * confirmed still live via direct staging DB query on 2026-08-15. No
 * reusable "discover or generate a bugs-capable workspace" Steps module
 * exists yet (flagged in atc/BK-477-assign-eligible-member.md §8 for a
 * future BugsSteps module), so a fixed, documented reference is the
 * Discover-tier precondition here — same convention as BK-6's
 * WORKSPACE_NOT_MEMBER_ID / WORKSPACE_SUSPENDED_ID fixtures.
 *
 * RESERVED FIXTURE — do not remove the member (c6a2b665-...) from this
 * workspace, and do not delete the workspace/project/module. Doing so
 * breaks this TC with a false result, not a real regression.
 */
const BK264_SANDBOX_PROJECT_ID = '2fee236f-1246-40c4-bfc4-d332287f9548'; // BK264 Defect Triage
const BK264_SANDBOX_MODULE_ID = '175f8a08-20b9-4c96-a21a-e02dcae2837e'; // Defect Triage Module
const BK264_SANDBOX_OWNER_USER_ID = '2742da39-e0ff-4f0c-a0a1-88dae804e14f'; // matches STAGING_USER_EMAIL
const BK264_SANDBOX_MEMBER_USER_ID = 'c6a2b665-c090-4b74-b3df-6abcdae40c89'; // bk264-member@ambuusteln.resend.app

const ELIGIBLE_ASSIGNEES = [
  { role: 'member', userId: BK264_SANDBOX_MEMBER_USER_ID },
  { role: 'owner', userId: BK264_SANDBOX_OWNER_USER_ID },
] as const;

test.describe('BK-264: Bug Assignment API', { tag: ['@critical'] }, () => {
  for (const { role, userId } of ELIGIBLE_ASSIGNEES) {
    /**
     * ATC: BK-477
     *
     * Precondition: fresh login as the sandbox workspace owner (Discover
     * pattern — reuses the seeded workspace) + Generate a fresh open,
     * unassigned bug via POST /bugs (Generate pattern — avoids collisions
     * across runs, unlike reusing a shared fixture bug).
     */
    test(
      `BK-264: should set assignee when assigning an open bug to an eligible member given the target role is "${role}"`,
      async ({ api }) => {
        // Precondition: authenticate fresh as the sandbox workspace owner
        await api.auth.authenticateSuccessfully({
          email: config.testUser.email,
          password: config.testUser.password,
        });

        // Precondition: Generate a fresh open, unassigned bug in the sandbox
        const [, filed] = await api.bugs.fileBugSuccessfully({
          project_id: BK264_SANDBOX_PROJECT_ID,
          module_id: BK264_SANDBOX_MODULE_ID,
          title: `BK-477 automated fixture bug (${role}) - ${Date.now()}`,
          severity: 'P3',
        });

        // ACTION + fixed assertions live inside the ATC
        const [, assigned] = await api.bugs.assignBugToEligibleMember(filed.bug.id, {
          assignee_user_id: userId,
        });

        // Test-level assertion: assign and status are independent (BK-484/TC12 covers this
        // formally; this is a light sanity check that assigning didn't touch status)
        expect(assigned.bug.status).toBe('open');
      },
    );
  }
});
