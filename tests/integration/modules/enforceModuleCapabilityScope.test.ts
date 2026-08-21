/**
 * KATA Architecture - Module Capability Scope Integration Tests
 *
 * BK-498 — capability-scope enforcement on the authoring domain (Modules
 * family, the Decision-Table anchor). Covers Batch A (TC1-5): `atc:write`
 * gates module creation, `atc:read` gates the nested user-stories read,
 * independently of each other — plus the unbound-PAT non-regression case
 * (AC-07: capability gating depends on scope + real membership, not
 * token-workspace binding).
 *
 * Batch B (TC6-10 — auth/membership/revocation edge cases). BK-569 (TC7 —
 * non-member rejection) is NOT implemented: a live staging probe showed the
 * planned precondition (`mintPatWithScopes({ workspace_id: WORKSPACE_NOT_MEMBER_ID })`)
 * 403s at MINT time ("You are not a member of the target workspace.") — the
 * test user cannot bind a PAT to a workspace it does not belong to at all, so
 * the /modules-endpoint-level membership-403 this TC targets is never
 * reachable under the current account. Flagged for a Code-phase follow-up
 * (needs a second real, non-member user account), not fabricated here.
 *
 * Project: integration (depends on api-setup)
 */

import { BK264_DEFECT_TRIAGE_PROJECT_ID, BK264_QA_SANDBOX_WORKSPACE_ID, DEFECT_TRIAGE_MODULE_ID } from '@data/constants';
import { config, test } from '@TestFixture';

test.describe('BK-498: Module Capability Scope API', { tag: ['@critical'] }, () => {
  /**
   * ATC: BK-556
   *
   * Precondition: fresh login + mint an `atc:write` PAT bound to the QA
   * sandbox workspace.
   */
  test(
    'BK-498: should create module successfully given a PAT scoped exactly atc:write',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      const pat = await api.tokens.mintPatWithScopes({
        scopes: ['atc:write'],
        workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID,
      });
      api.modules.setAuthToken(pat.token);

      // ACTION: create a uniquely-named module — ATC handles fixed assertions
      // (201, body.module.id defined)
      await api.modules.createModuleSuccessfully(BK264_DEFECT_TRIAGE_PROJECT_ID, {
        name: api.data.createTestId('module'),
      });
    },
  );

  /**
   * ATC: BK-560
   *
   * Precondition: fresh login + mint an `atc:read`-only PAT bound to the QA
   * sandbox workspace.
   */
  test(
    'BK-498: should reject module creation with 403 and no side effect given a PAT scoped exactly atc:read',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      const pat = await api.tokens.mintPatWithScopes({
        scopes: ['atc:read'],
        workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID,
      });
      api.modules.setAuthToken(pat.token);

      // ACTION: attempt to create a module with a read-only PAT — ATC handles
      // fixed assertions (403, message names the missing atc:write capability)
      await api.modules.rejectModuleCreationReadOnlyPat(BK264_DEFECT_TRIAGE_PROJECT_ID, {
        name: api.data.createTestId('module'),
      });

      // TODO(BK-498/TC2 zero-side-effect check): the ATP's own test-level
      // assertion calls for a follow-up read confirming no module row was
      // inserted, but no "list modules by name" endpoint is in this plan's
      // scope (§2 Architecture Decisions only wires POST modules + GET
      // user-stories for ModulesApi) — GET /modules/{id} requires knowing the
      // id up front, which a rejected creation never returns. Skipping the
      // strict re-check for Batch A per the automation-plan's explicit
      // no-runtime-DB-client constraint; revisit if a list-modules endpoint
      // is added to ModulesApi's scope in a later batch.
    },
  );

  /**
   * ATC: BK-562
   *
   * Precondition: fresh login + mint an unbound `atc:write` PAT (no
   * `workspace_id`) — the underlying user is still a real, active member of
   * the target project's workspace.
   */
  test(
    'BK-498: should create module successfully given an unbound atc:write PAT held by a real workspace member',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      const pat = await api.tokens.mintPatWithScopes({
        scopes: ['atc:write'],
      });
      api.modules.setAuthToken(pat.token);

      // ACTION: create a module with an unbound PAT — ATC handles fixed
      // assertions (201, capability gating does not depend on token-workspace binding)
      await api.modules.createModuleWithUnboundPat(BK264_DEFECT_TRIAGE_PROJECT_ID, {
        name: api.data.createTestId('module'),
      });
    },
  );

  /**
   * ATC: BK-564
   *
   * Precondition: fresh login + mint an `atc:read` PAT bound to the QA
   * sandbox workspace.
   */
  test(
    'BK-498: should list user stories successfully given a PAT scoped atc:read',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      const pat = await api.tokens.mintPatWithScopes({
        scopes: ['atc:read'],
        workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID,
      });
      api.modules.setAuthToken(pat.token);

      // ACTION: list the fixture module's user stories — ATC handles fixed
      // assertions (200, response body is a list)
      await api.modules.listUserStoriesSuccessfully(DEFECT_TRIAGE_MODULE_ID);
    },
  );

  /**
   * ATC: BK-565
   *
   * Precondition: fresh login + mint an `atc:write`-only PAT bound to the QA
   * sandbox workspace.
   */
  test(
    'BK-498: should reject a read request with 403 given a PAT scoped only atc:write',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      const pat = await api.tokens.mintPatWithScopes({
        scopes: ['atc:write'],
        workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID,
      });
      api.modules.setAuthToken(pat.token);

      // ACTION: attempt to list user stories with a write-only PAT — ATC
      // handles fixed assertions (403, message names the missing atc:read capability)
      await api.modules.rejectReadWithWriteOnlyPat(DEFECT_TRIAGE_MODULE_ID);
    },
  );

  /**
   * ATC: BK-567
   *
   * Precondition: no auth call at all — fresh `{ api }` fixture instance,
   * never authenticated, `modules.clearAuthToken()` explicit for clarity.
   */
  test(
    'BK-498: should return 401 unauthenticated when no token is presented',
    async ({ api }) => {
      api.modules.clearAuthToken();

      // ACTION: attempt to create a module with no Authorization header and no
      // cookie session — ATC handles fixed assertions (401, verbatim
      // "Authentication required." message, distinct from a capability 403)
      await api.modules.rejectUnauthenticatedModuleCreation(BK264_DEFECT_TRIAGE_PROJECT_ID, {
        name: api.data.createTestId('module'),
      });
    },
  );

  /**
   * NOTE: Scenario 7 (BK-569 / TC7 — non-member membership-403) intentionally
   * NOT implemented in this batch — see the file-header note and
   * ModulesApi.ts's inline comment above the (removed) BK-569 method.
   */

  /**
   * ATC: BK-570
   *
   * Precondition: fresh login + mint a PAT scoped with the framework's
   * default capability set (`atc:read`, `atc:write`, `run:execute`), bound
   * to the QA sandbox workspace.
   */
  test(
    'BK-498: should continue succeeding on both read and write given a default-scoped PAT',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      const pat = await api.tokens.mintPatWithScopes({
        scopes: ['atc:read', 'atc:write', 'run:execute'],
        workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID,
      });
      api.modules.setAuthToken(pat.token);

      // ACTION: create then read back — ATC handles fixed assertions
      // (201 on create, 200 on the subsequent read)
      await api.modules.defaultScopeSucceedsOnWriteAndRead(
        BK264_DEFECT_TRIAGE_PROJECT_ID,
        DEFECT_TRIAGE_MODULE_ID,
        { name: api.data.createTestId('module') },
      );
    },
  );

  /**
   * ATC: BK-557
   *
   * Precondition: fresh login (establishes session cookie) then
   * `modules.clearAuthToken()` to force cookie-only, no Bearer PAT.
   */
  test(
    'BK-498: should create module successfully via an authenticated browser session regardless of any PAT scope restriction',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      api.modules.clearAuthToken();

      // ACTION: create a module using only the session cookie — ATC handles
      // fixed assertions (201, browser sessions are never narrowed like a PAT)
      await api.modules.createModuleViaSessionRegardlessOfPatScope(BK264_DEFECT_TRIAGE_PROJECT_ID, {
        name: api.data.createTestId('module'),
      });
    },
  );

  /**
   * ATC: BK-558
   *
   * Precondition: fresh login + mint an `atc:write` PAT bound to the QA
   * sandbox workspace, then immediately revoke it (session-authenticated).
   */
  test(
    'BK-498: should return 401 for a revoked atc:write token, distinct from the 403 an under-scoped-but-valid token receives',
    async ({ api }) => {
      await api.auth.authenticateSuccessfully({
        email: config.testUser.email,
        password: config.testUser.password,
      });
      const pat = await api.tokens.mintPatWithScopes({
        scopes: ['atc:write'],
        workspace_id: BK264_QA_SANDBOX_WORKSPACE_ID,
      });
      // Revocation is session-authenticated only (BK-553) — mintPatWithScopes
      // restores whatever Bearer token was ambient on `api.tokens` before the
      // mint call (the default-scope PAT api-setup loads), so force cookie-only
      // here or the revoke itself would be rejected with a 403.
      api.tokens.clearAuthToken();
      await api.tokens.revokeToken(pat.id);
      api.modules.setAuthToken(pat.token);

      // ACTION: attempt to create a module with the now-revoked token — ATC
      // handles fixed assertions (401, verbatim "Invalid token." message,
      // distinct from a capability 403)
      await api.modules.rejectRevokedTokenWithInvalidMessage(BK264_DEFECT_TRIAGE_PROJECT_ID, {
        name: api.data.createTestId('module'),
      });
    },
  );
});
