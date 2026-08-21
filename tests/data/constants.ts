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
 * Fixed reference project/workspace/module used by BK-498's capability-scope
 * enforcement TCs on the authoring domain (Modules family). Same fixtures
 * Stage 2 execution used live on staging (Engram `#216`) — a real project the
 * BK-6 test user is an active member of, with a pre-existing module to read
 * user stories from.
 *
 * Promoted here (not file-local) since BK-498's plan already scopes these as
 * shared across both `ModulesApi` and the later `AuthoringSweepApi` test files.
 */
export const BK264_DEFECT_TRIAGE_PROJECT_ID = '2fee236f-1246-40c4-bfc4-d332287f9548';
export const BK264_QA_SANDBOX_WORKSPACE_ID = '6646f244-a28c-441e-8486-9af33bdb5c11';
export const DEFECT_TRIAGE_MODULE_ID = '175f8a08-20b9-4c96-a21a-e02dcae2837e';
