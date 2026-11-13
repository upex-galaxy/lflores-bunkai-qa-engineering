/**
 * KATA Architecture - Bug Assignment Integration Tests
 *
 * Tests for the defect-assignment endpoint (POST /bugs/{id}/assign).
 * Validates that a bug can be assigned to an eligible workspace member
 * (role "member" or "owner", active status).
 *
 * Project: integration (depends on api-setup)
 */

import { QA_WORKSPACE_MEMBER_USER_ID, QA_WORKSPACE_MODULE_ID, QA_WORKSPACE_OWNER_USER_ID, QA_WORKSPACE_PROJECT_ID } from '@data/constants';
import { config, expect, test } from '@TestFixture';

/**
 * Fixed reference workspace (owner + member + project + module): the shared
 * QA workspace fixtures in `@data/constants`, where their provenance and the
 * RESERVED FIXTURE warning live. No reusable "discover or generate a
 * bugs-capable workspace" Steps module exists yet (flagged in
 * atc/BK-477-assign-eligible-member.md §8 for a future BugsSteps module), so
 * a fixed, documented reference is the Discover-tier precondition here —
 * same convention as BK-6's WORKSPACE_NOT_MEMBER_ID / WORKSPACE_SUSPENDED_ID
 * fixtures.
 */

const ELIGIBLE_ASSIGNEES = [
  { role: 'member', userId: QA_WORKSPACE_MEMBER_USER_ID },
  { role: 'owner', userId: QA_WORKSPACE_OWNER_USER_ID },
] as const;

test.describe('BK-264: Bug Assignment API', { tag: ['@critical'] }, () => {
  for (const { role, userId } of ELIGIBLE_ASSIGNEES) {
    /**
     * ATC: BK-477
     *
     * Precondition: fresh login as the QA workspace owner (Discover
     * pattern — reuses the seeded workspace) + Generate a fresh open,
     * unassigned bug via POST /bugs (Generate pattern — avoids collisions
     * across runs, unlike reusing a shared fixture bug).
     */
    test(
      `BK-264: should set assignee when assigning an open bug to an eligible member given the target role is "${role}"`,
      async ({ api }) => {
        // Precondition: authenticate fresh as the QA workspace owner
        await api.auth.authenticateSuccessfully({
          email: config.testUser.email,
          password: config.testUser.password,
        });

        // Precondition: Generate a fresh open, unassigned bug in the QA workspace
        const [, filed] = await api.bugs.fileBugSuccessfully({
          project_id: QA_WORKSPACE_PROJECT_ID,
          module_id: QA_WORKSPACE_MODULE_ID,
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
