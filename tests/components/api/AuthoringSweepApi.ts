/**
 * KATA Architecture - Layer 3: Authoring Sweep API Component
 *
 * API component for the cross-family capability-scope sweep (BK-498, TC11-15):
 * confirms the SAME `atc:write`/`atc:read` gate logic that `ModulesApi` proves
 * for Modules also applies to 5 other authoring-domain resource families —
 * User Stories, Acceptance Criteria, Environments, Milestones, Imports —
 * "only the wiring varies per family" (automation-plan.md §2). Also owns the
 * Imports dual-scope positive control (TC15), proving the Imports-family 403
 * rows in TC11/TC14 are a ratified non-defect, not a regression.
 *
 * ATCs follow flow-based design: each ATC is an ACTION + VERIFICATION,
 * not a simple POST/GET. See atc/BK-559-*.md and siblings for the full
 * contracts (fixed vs test-level assertion split).
 *
 * Endpoints:
 * - POST /api/v1/modules/{id}/user-stories - Create a user story (member-only, atc:write)
 * - GET  /api/v1/user-stories/{id} - Read a user story (member-only, atc:read)
 * - POST /api/v1/user-stories/{id}/acceptance-criteria - Add an acceptance criterion (member-only, atc:write)
 * - GET  /api/v1/acceptance-criteria/{id} - Read an acceptance criterion (member-only, atc:read)
 * - POST /api/v1/projects/{id}/environments - Add a project environment (member-only, atc:write)
 * - GET  /api/v1/projects/{id}/environments - List a project's environments (member-only, atc:read)
 * - POST /api/v1/projects/{id}/milestones - Create a project milestone (member-only, atc:write)
 * - GET  /api/v1/projects/{id}/milestones - List a project's milestones (member-only, atc:read)
 * - POST /api/v1/imports - Enqueue an async Jira import (member-only, atc:write) - 202, at most 1 active per project (409)
 * - GET  /api/v1/imports/{id} - Poll an import job (member-only, atc:read)
 */

import type { APIResponse } from '@playwright/test';
import type {
  AcceptanceCriterionPayload,
  AcceptanceCriterionResponse,
  AtcCreatePayload,
  AtcResponse,
  EnvironmentListResponse,
  EnvironmentPayload,
  EnvironmentResponse,
  ImportEnqueueResponse,
  ImportJobResponse,
  ImportPayload,
  MilestoneListResponse,
  MilestonePayload,
  MilestoneResponse,
  TestCreatePayload,
  TestResponse,
  UserStoryPayload,
  UserStoryResponse,
} from '@schemas/authoring-sweep.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

// Re-export types for consumers that import from AuthoringSweepApi
export type {
  AcceptanceCriterionPayload,
  AcceptanceCriterionResponse,
  AtcCreatePayload,
  AtcResponse,
  EnvironmentListResponse,
  EnvironmentPayload,
  EnvironmentResponse,
  ImportEnqueueResponse,
  ImportJobResponse,
  ImportPayload,
  MilestoneListResponse,
  MilestonePayload,
  MilestoneResponse,
  TestCreatePayload,
  TestResponse,
  UserStoryPayload,
  UserStoryResponse,
} from '@schemas/authoring-sweep.types';
export type { ErrorEnvelope } from '@schemas/modules.types';

// ============================================
// Row / dispatch types (component-internal composition, not OpenAPI wire shapes)
// ============================================

/** The 5 authoring-domain resource families this sweep exercises. */
export type AuthoringFamily = 'userStories' | 'acceptanceCriteria' | 'environments' | 'milestones' | 'imports';

/**
 * One family's write-attempt outcome. `id` is the key needed to READ this family back
 * afterwards — for `environments`/`milestones` (list-only read endpoints) that's the
 * project id, NOT the created row's own id; for the other 3 families it IS the created
 * row's own id. See `readFamilyRow`.
 */
export interface AuthoringFamilyWriteResult {
  family: AuthoringFamily
  id: string
  response: APIResponse
}

/** One family's read-attempt outcome. */
export interface AuthoringFamilyReadResult {
  family: AuthoringFamily
  response: APIResponse
}

/** Row descriptor consumed by `readFamilyRow` — `id` per `AuthoringFamilyWriteResult`'s doc above. */
export interface AuthoringFamilyRow {
  family: AuthoringFamily
  id: string
}

/**
 * JQL deliberately matching no real Jira issues, so the import job completes
 * fast with a zero-row result instead of mutating shared staging data.
 * Confirmed accepted by POST /imports via a live Code-phase probe (no format
 * validation beyond `jql: string` — see the OpenAPI body schema) — see the
 * component report for the specific probe result.
 */
const SWEEP_IMPORT_JQL = 'project = ZZZNOTREAL';

// ============================================
// Authoring Sweep API Component
// ============================================

export class AuthoringSweepApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers - per-family raw wrappers (no fixed assertions, callers own their own)
  // ============================================

  /** Helper: Raw POST /modules/{id}/user-stories wrapper. */
  @step
  async createUserStory(moduleId: string, payload: UserStoryPayload): Promise<[APIResponse, UserStoryResponse, UserStoryPayload]> {
    return this.apiPOST<UserStoryResponse, UserStoryPayload>(`/modules/${moduleId}/user-stories`, payload);
  }

  /** Helper: Raw GET /user-stories/{id} wrapper. */
  @step
  async getUserStory(id: string): Promise<[APIResponse, UserStoryResponse]> {
    return this.apiGET<UserStoryResponse>(`/user-stories/${id}`);
  }

  /**
   * Helper: Raw POST /user-stories/{id}/acceptance-criteria wrapper — `{id}` here is a
   * USER STORY id, not a module id.
   */
  @step
  async createAcceptanceCriterion(
    userStoryId: string,
    payload: AcceptanceCriterionPayload,
  ): Promise<[APIResponse, AcceptanceCriterionResponse, AcceptanceCriterionPayload]> {
    return this.apiPOST<AcceptanceCriterionResponse, AcceptanceCriterionPayload>(
      `/user-stories/${userStoryId}/acceptance-criteria`,
      payload,
    );
  }

  /** Helper: Raw GET /acceptance-criteria/{id} wrapper. */
  @step
  async getAcceptanceCriterion(id: string): Promise<[APIResponse, AcceptanceCriterionResponse]> {
    return this.apiGET<AcceptanceCriterionResponse>(`/acceptance-criteria/${id}`);
  }

  /** Helper: Raw POST /projects/{id}/environments wrapper. */
  @step
  async createEnvironment(projectId: string, payload: EnvironmentPayload): Promise<[APIResponse, EnvironmentResponse, EnvironmentPayload]> {
    return this.apiPOST<EnvironmentResponse, EnvironmentPayload>(`/projects/${projectId}/environments`, payload);
  }

  /** Helper: Raw GET /projects/{id}/environments wrapper — list endpoint, no single-item read exists. */
  @step
  async getEnvironments(projectId: string): Promise<[APIResponse, EnvironmentListResponse]> {
    return this.apiGET<EnvironmentListResponse>(`/projects/${projectId}/environments`);
  }

  /** Helper: Raw POST /projects/{id}/milestones wrapper. */
  @step
  async createMilestone(projectId: string, payload: MilestonePayload): Promise<[APIResponse, MilestoneResponse, MilestonePayload]> {
    return this.apiPOST<MilestoneResponse, MilestonePayload>(`/projects/${projectId}/milestones`, payload);
  }

  /** Helper: Raw GET /projects/{id}/milestones wrapper — list endpoint, no single-item read exists. */
  @step
  async getMilestones(projectId: string): Promise<[APIResponse, MilestoneListResponse]> {
    return this.apiGET<MilestoneListResponse>(`/projects/${projectId}/milestones`);
  }

  /** Helper: Raw POST /imports wrapper — enqueues an async Jira import (202). */
  @step
  async createImport(payload: ImportPayload): Promise<[APIResponse, ImportEnqueueResponse, ImportPayload]> {
    return this.apiPOST<ImportEnqueueResponse, ImportPayload>('/imports', payload);
  }

  /** Helper: Raw GET /imports/{id} wrapper — polls a single import job snapshot. */
  @step
  async getImportJob(id: string): Promise<[APIResponse, ImportJobResponse]> {
    return this.apiGET<ImportJobResponse>(`/imports/${id}`);
  }

  /**
   * Helper: Raw POST /atcs wrapper — creates a product-domain ATC (chained
   * by a Test, distinct from KATA's `@atc`). BK-499's TC3/TC4 precondition
   * chain: a Test needs `atc_ids`, and an ATC needs an anchoring
   * `user_story_id` + `acceptance_criterion_ids`. Not an ATC on its own.
   */
  @step
  async createAtc(payload: AtcCreatePayload): Promise<[APIResponse, AtcResponse, AtcCreatePayload]> {
    return this.apiPOST<AtcResponse, AtcCreatePayload>('/atcs', payload);
  }

  /**
   * Helper: Raw POST /tests wrapper — chains one or more ATCs into a Test.
   * Requires an `Idempotency-Key` header (BK-499's TC3/TC4 precondition
   * chain: `GET /tests/{id}/runs` needs a real `test_id`). Not an ATC on
   * its own.
   */
  @step
  async createTest(payload: TestCreatePayload): Promise<[APIResponse, TestResponse, TestCreatePayload]> {
    return this.apiPOST<TestResponse, TestCreatePayload>('/tests', payload, {
      headers: { 'Idempotency-Key': this.data.createTestId('idem') },
    });
  }

  /**
   * Helper: Dispatch a read by family — routes to the correct per-family GET
   * wrapper above. Shared by BK-563 (accept) and BK-566 (reject); not an ATC
   * on its own (no fixed assertions — callers own theirs).
   *
   * @param row - Family + the id needed to read it back (see `AuthoringFamilyRow` doc)
   * @returns The raw response for that family's read call
   */
  @step
  async readFamilyRow(row: AuthoringFamilyRow): Promise<APIResponse> {
    switch (row.family) {
      case 'userStories': {
        const [response] = await this.getUserStory(row.id);
        return response;
      }
      case 'acceptanceCriteria': {
        const [response] = await this.getAcceptanceCriterion(row.id);
        return response;
      }
      case 'environments': {
        const [response] = await this.getEnvironments(row.id);
        return response;
      }
      case 'milestones': {
        const [response] = await this.getMilestones(row.id);
        return response;
      }
      case 'imports': {
        const [response] = await this.getImportJob(row.id);
        return response;
      }
      default: {
        const exhaustiveCheck: never = row.family;
        throw new Error(`Unknown authoring family: ${String(exhaustiveCheck)}`);
      }
    }
  }

  /**
   * Helper: Poll GET /imports/{id} (condition-based, `expect.poll()`) until the
   * job leaves `queued`/`running` — i.e. reaches `completed` or `failed`.
   *
   * Shared by BK-561 (drains the Imports row it creates, so the project's
   * "at most one active import" lock clears before the ATC returns) and
   * BK-568 (the embedded create->poll positive control). Never uses
   * `waitForTimeout` (rule #10).
   *
   * @param importJobId - The job id returned by `createImport`
   * @returns Tuple with the final poll response and body, once terminal
   */
  @step
  async pollImportJobUntilTerminal(importJobId: string): Promise<[APIResponse, ImportJobResponse]> {
    let lastResponse!: APIResponse;
    let lastBody!: ImportJobResponse;

    await expect.poll(
      async () => {
        [lastResponse, lastBody] = await this.getImportJob(importJobId);
        return lastBody.import_job.status;
      },
      {
        message: `waiting for import job ${importJobId} to leave queued/running`,
        timeout: 30_000,
      },
    ).toMatch(/^(completed|failed)$/);

    return [lastResponse, lastBody];
  }

  /**
   * Helper: Deterministic target_date (YYYY-MM-DD), N days from today (UTC) —
   * satisfies MilestoneCreateBody's "today-or-later, within 5 years" bound.
   */
  private targetDateDaysFromNow(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: Attempt a minimal-valid write on all 5 authoring families using a PAT
   * scoped exactly `atc:read` - expects rejection (403) on every row
   *
   * Complete flow:
   * 1. POST a minimal-valid write to each of the 5 families' write endpoint,
   *    using an `atc:read`-only PAT (ACTION, one call per family)
   * 2. Validate every row is rejected for missing `atc:write` (fixed assertions)
   *
   * The Imports row's 403 is expected behavior (ratified 2026-08-19 AI PO
   * decision, positive control lives in BK-568), not a defect — asserted the
   * same as every other row, no special-casing.
   *
   * Max-2-positional-params exception (documented, same class as
   * `ModulesApi.defaultScopeSucceedsOnWriteAndRead`): needs 3 - a module id
   * (User Stories row), a project id (Environments/Milestones/Imports rows),
   * and a user-story id (Acceptance Criteria row's required parent).
   *
   * @param moduleId - Target module id (User Stories row)
   * @param projectId - Target project id (Environments/Milestones/Imports rows)
   * @param userStoryId - Parent user-story id, pre-discovered/created under the
   *   OWNER session before this ATC's under-scoped PAT is set (Acceptance
   *   Criteria row's required parent)
   * @returns Per-family write results (family + response)
   */
  @atc('BK-559')
  async rejectWritesAcrossFamilies(
    moduleId: string,
    projectId: string,
    userStoryId: string,
  ): Promise<AuthoringFamilyReadResult[]> {
    const results: AuthoringFamilyReadResult[] = [];

    const [usResponse] = await this.createUserStory(moduleId, { title: this.data.createTestId('sweep-us') });
    results.push({ family: 'userStories', response: usResponse });

    const [acResponse] = await this.createAcceptanceCriterion(userStoryId, { title: this.data.createTestId('sweep-ac') });
    results.push({ family: 'acceptanceCriteria', response: acResponse });

    const [envResponse] = await this.createEnvironment(projectId, { name: this.data.createTestId('sweep-env') });
    results.push({ family: 'environments', response: envResponse });

    const [msResponse] = await this.createMilestone(projectId, {
      name: this.data.createTestId('sweep-ms'),
      target_date: this.targetDateDaysFromNow(7),
    });
    results.push({ family: 'milestones', response: msResponse });

    const [impResponse] = await this.createImport({ project_id: projectId, jql: SWEEP_IMPORT_JQL });
    results.push({ family: 'imports', response: impResponse });

    // Fixed assertions - every row rejected for missing atc:write, Imports row included
    for (const row of results) {
      expect(row.response.status()).toBe(403);
    }

    return results;
  }

  /**
   * ATC: Perform a minimal-valid write on all 5 authoring families using a PAT
   * scoped exactly `atc:write` - expects success (2xx) on every row
   *
   * Complete flow:
   * 1. POST a minimal-valid write to each of the 5 families' write endpoint,
   *    using an `atc:write`-scoped PAT (ACTION, one call per family)
   * 2. Validate every row succeeded and a side-effect id exists (fixed assertions)
   * 3. Drain the Imports row to a terminal state (`completed`/`failed`) before
   *    returning — the project allows at most one active import at a time
   *    (409); TC15 (BK-568) targets the same project later in the same
   *    serial test file, so this ATC must not leave the lock held
   *
   * Returns the created-row refs; TC13 (BK-563) and TC14 (BK-566) consume
   * them as a parameter in the same test (no ATC-calls-ATC — they receive
   * the refs, they don't create them).
   *
   * Max-2-positional-params exception — see BK-559's docstring, same class.
   *
   * @param moduleId - Target module id (User Stories row)
   * @param projectId - Target project id (Environments/Milestones/Imports rows)
   * @param userStoryId - Parent user-story id (Acceptance Criteria row's required parent)
   * @returns Per-family write results (family + read-key id + response) — see
   *   `AuthoringFamilyWriteResult` doc for what `id` means per family
   */
  @atc('BK-561')
  async acceptWritesAcrossFamilies(
    moduleId: string,
    projectId: string,
    userStoryId: string,
  ): Promise<AuthoringFamilyWriteResult[]> {
    const results: AuthoringFamilyWriteResult[] = [];

    const [usResponse, usBody] = await this.createUserStory(moduleId, { title: this.data.createTestId('sweep-us') });
    results.push({ family: 'userStories', id: usBody.user_story.id, response: usResponse });

    const [acResponse, acBody] = await this.createAcceptanceCriterion(userStoryId, { title: this.data.createTestId('sweep-ac') });
    results.push({ family: 'acceptanceCriteria', id: acBody.acceptance_criterion.id, response: acResponse });

    // Environments/Milestones only expose a LIST read (GET /projects/{id}/...)
    // — no single-item read endpoint — so the read-key stored here is the
    // project id, not the created row's own id. The row's own id is still
    // asserted as present below, from the create response body directly.
    const [envResponse, envBody] = await this.createEnvironment(projectId, { name: this.data.createTestId('sweep-env') });
    results.push({ family: 'environments', id: projectId, response: envResponse });

    const [msResponse, msBody] = await this.createMilestone(projectId, {
      name: this.data.createTestId('sweep-ms'),
      target_date: this.targetDateDaysFromNow(7),
    });
    results.push({ family: 'milestones', id: projectId, response: msResponse });

    const [impResponse, impBody] = await this.createImport({ project_id: projectId, jql: SWEEP_IMPORT_JQL });
    results.push({ family: 'imports', id: impBody.import_job_id, response: impResponse });

    // Fixed assertions - every row succeeds (2xx) and its own side-effect id exists
    expect(envBody.environment.id).toBeDefined();
    expect(msBody.milestone.id).toBeDefined();
    for (const row of results) {
      expect(row.response.status()).toBeGreaterThanOrEqual(200);
      expect(row.response.status()).toBeLessThan(300);
      expect(row.id).toBeDefined();
    }

    // Drain the Imports row before returning — clears the project's
    // active-import lock so BK-568 (same project, same serial test file)
    // never collides with a still-active job from this ATC. Polling requires
    // `atc:read`, which this ATC's write-only PAT does not carry — fall back
    // to the OWNER session's cookie (established by the calling test's
    // earlier `authenticateSuccessfully()`, never narrowed like a PAT — see
    // BK-557) for the drain poll only, then restore the write PAT. Same
    // suspend/restore shape as `TokensApi.mintPatWithScopes`.
    const ambientToken = this.authToken;
    this.clearAuthToken();
    try {
      await this.pollImportJobUntilTerminal(impBody.import_job_id);
    }
    finally {
      if (ambientToken) { this.setAuthToken(ambientToken); }
    }

    return results;
  }

  /**
   * ATC: Read back all 5 rows created by BK-561 using a PAT scoped exactly
   * `atc:read` - expects success (200) on every row
   *
   * Complete flow:
   * 1. GET each of the 5 rows returned by `acceptWritesAcrossFamilies`, using
   *    a SEPARATE `atc:read`-scoped PAT than BK-561's write PAT (ACTION, one
   *    call per family, dispatched via `readFamilyRow`)
   * 2. Validate every row is readable (fixed assertions)
   *
   * Consumes BK-561's row refs as a parameter — does not create them itself,
   * satisfying "ATC does not call ATC".
   *
   * @param rows - The 5 row refs returned by `acceptWritesAcrossFamilies` in the same test
   * @returns Per-family read results (family + response)
   */
  @atc('BK-563')
  async acceptReadsAcrossFamilies(rows: AuthoringFamilyRow[]): Promise<AuthoringFamilyReadResult[]> {
    const results: AuthoringFamilyReadResult[] = [];

    for (const row of rows) {
      const response = await this.readFamilyRow(row);
      results.push({ family: row.family, response });
    }

    // Fixed assertions - every row readable
    for (const row of results) {
      expect(row.response.status()).toBe(200);
    }

    return results;
  }

  /**
   * ATC: Read back all 5 rows created by BK-561 using the SAME write-only
   * `atc:write` PAT from BK-561's precondition (no `atc:read`) - expects
   * rejection (403) on every row
   *
   * Complete flow:
   * 1. GET each of the 5 rows returned by `acceptWritesAcrossFamilies`, using
   *    the write-only PAT (ACTION, one call per family, dispatched via
   *    `readFamilyRow`)
   * 2. Validate every row is rejected for missing `atc:read` (fixed assertions)
   *
   * The Imports row's 403 is the ratified expected behavior (2026-08-19 AI PO
   * decision), NOT a regression — the positive control is BK-568.
   *
   * @param rows - The 5 row refs returned by `acceptWritesAcrossFamilies` in the same test
   * @returns Per-family read results (family + response)
   */
  @atc('BK-566')
  async rejectReadsAcrossFamilies(rows: AuthoringFamilyRow[]): Promise<AuthoringFamilyReadResult[]> {
    const results: AuthoringFamilyReadResult[] = [];

    for (const row of rows) {
      const response = await this.readFamilyRow(row);
      results.push({ family: row.family, response });
    }

    // Fixed assertions - every row rejected for missing atc:read, Imports row included
    for (const row of results) {
      expect(row.response.status()).toBe(403);
    }

    return results;
  }

  /**
   * ATC: Enqueue then poll a Jira import to completion using a PAT scoped
   * BOTH `atc:write` and `atc:read` - expects success on both actions (202/200)
   *
   * Complete flow:
   * 1. POST /imports (queues the import job) (ACTION 1)
   * 2. Poll GET /imports/{id} (condition-based, never `waitForTimeout`) until
   *    the job reaches a terminal state (ACTION 2 / VERIFICATION)
   *
   * Embeds 2 raw HTTP calls (via `createImport`/`pollImportJobUntilTerminal`,
   * both `@step` helpers) — not other `@atc` methods, so this does not
   * violate the ATC-calls-ATC rule (mirrors `TokensApi.allowSessionAuthenticatedTokenLifecycle`'s
   * embedded-chain pattern). Positive control for BK-559/BK-566's
   * Imports-family 403 rows: proves a client needs BOTH capabilities to
   * complete the Imports workflow, so those 403s are expected, not a defect.
   *
   * @param projectId - Target project id
   * @returns Tuple with the enqueue response and the final poll response
   */
  @atc('BK-568')
  async completeImportLifecycleDualScope(projectId: string): Promise<[APIResponse, APIResponse]> {
    // ACTION 1: enqueue
    const [enqueueResponse, enqueueBody] = await this.createImport({ project_id: projectId, jql: SWEEP_IMPORT_JQL });
    expect(enqueueResponse.status()).toBe(202);
    expect(enqueueBody.import_job_id).toBeDefined();

    // ACTION 2: poll to terminal (VERIFICATION)
    const [finalResponse, finalBody] = await this.pollImportJobUntilTerminal(enqueueBody.import_job_id);
    expect(finalResponse.status()).toBe(200);
    expect(finalBody.import_job.status).toBe('completed');

    return [enqueueResponse, finalResponse];
  }
}
