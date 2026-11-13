/**
 * KATA Architecture - Static Test Constants
 *
 * Static test values, magic numbers, boundary constants — the third canonical
 * `tests/data/` file (see kata-architecture.md §2). Complements `DataFactory.ts`
 * (dynamic faker-backed generation) with committed, deterministic reference values
 * that cannot be safely discovered or generated at runtime.
 */

/**
 * Fixed reference workspace where the BK-6 test user has zero `workspace_members`
 * rows — validated via direct staging DB query on 2026-08-07. No runtime DB client
 * exists in this framework and no API endpoint can discover a "workspace I am NOT a
 * member of" (would be a cross-tenant data leak), so a fixed, documented reference is
 * the only viable Discover-adjacent strategy here (Generate via signup+email+confirm
 * was rejected as disproportionate for a single negative-path check).
 *
 * Originally file-local to `tests/integration/workspace/switchActiveWorkspace.test.ts`
 * (BK-251). Promoted here for BK-497/BK-551, which needs the identical "real
 * workspace, not a member" fixture for a cross-workspace-binding guard check —
 * now shared by 2 files, meeting the extraction threshold.
 *
 * RESERVED FIXTURE — do not add the BK-6 test user as a member of this workspace, and
 * do not delete it. Doing so breaks these TCs with a false result, not a real regression.
 */
export const WORKSPACE_NOT_MEMBER_ID = '047c106e-5334-4a80-8b66-d99ef4c474b4'; // bunkai1-qa

/**
 * Syntactically PAT-shaped Bearer token that was never minted — deliberately invalid.
 * Used to prove identity resolution (`resolveIdentity`) rejects with 401 BEFORE any
 * downstream `cookie-only` posture check runs (BK-546, Error Guessing charter).
 * Determinism preferred over faker randomness: the value's specific shape doesn't
 * matter, only that it never resolves to a real token.
 */
export const INVALID_BEARER_TOKEN = 'bk_pat_invalid.does-not-exist-00000000';

/**
 * QA workspace — the staging workspace "luisflores" owned by the main test user
 * (`STAGING_USER_EMAIL`), with Jira connected. Shared by the authoring,
 * capability, modules and bugs (defect-triage) suites. Seeded 2026-11-12,
 * replacing the retired "BK-264 QA Sandbox" fixtures (staging-user-migration).
 *
 * Members (one per role; user ids read back from `workspace_members`):
 * - owner  = `STAGING_USER_EMAIL`
 * - member = `STAGING_MEMBER_EMAIL`
 * - viewer = `STAGING_VIEWER_EMAIL`
 *
 * RESERVED FIXTURE — do not remove any of these members, disconnect Jira, or
 * delete the workspace/project/module. Doing so breaks these TCs with a false
 * result, not a real regression.
 */
export const QA_WORKSPACE_ID = '18a65b3b-6f03-478a-93b3-b7a3ae518d40'; // luisflores
export const QA_WORKSPACE_PROJECT_ID = '0fe6b7ba-20ef-4486-a7e4-16c7572adee3'; // QA Defect Triage
export const QA_WORKSPACE_MODULE_ID = '589e386c-4220-4dbd-9519-66cf19f40c75'; // Defect Triage
export const QA_WORKSPACE_OWNER_USER_ID = '01166a16-607b-4fd2-b72e-288672ff1dd5'; // STAGING_USER_EMAIL
export const QA_WORKSPACE_MEMBER_USER_ID = 'a8548f64-1aa8-43b1-9a5b-c44b27c4782a'; // STAGING_MEMBER_EMAIL
export const QA_WORKSPACE_VIEWER_USER_ID = '23673d9a-4aac-46eb-ba63-c9d58a245458'; // STAGING_VIEWER_EMAIL
