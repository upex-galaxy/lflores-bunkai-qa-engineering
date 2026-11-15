/**
 * KATA Architecture - Layer 3: Coverage API Component
 *
 * API component for the workspace-wide test-coverage summary behind the Home
 * "Coverage" stat card (BK-259).
 *
 * ATCs follow flow-based design: each ATC is an ACTION + VERIFICATION,
 * not a simple GET. See atc/BK-872-*.md for the full contract (fixed vs
 * test-level assertion split).
 *
 * Endpoints:
 * - GET /api/v1/workspaces/{id}/coverage - Workspace coverage rollup (atc:read)
 */

import type { APIResponse } from '@playwright/test';
import type { ErrorEnvelope, WorkspaceCoverage } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc } from '@utils/decorators';

// Re-export types for consumers that import from CoverageApi
export type { ErrorEnvelope, WorkspaceCoverage } from '@schemas/workspace.types';

// ============================================
// Row / result types (component-internal composition, not OpenAPI wire shapes)
// ============================================

/**
 * One row of BK-873's Scenario Outline Examples table: the PAT's scope and the
 * raw token carrying it. The status the gate must answer with is NOT part of
 * the row: it is the ATC's own invariant, derived from the scope.
 */
export interface CoverageScopeRow {
  scope: 'atc:read' | 'atc:write'
  token: string
}

/** The gate's verdict per scope (BK-873 Examples table): `atc:write` does not substitute for `atc:read`. */
const COVERAGE_SCOPE_VERDICT = { 'atc:read': 200, 'atc:write': 403 } as const;

/** One row's outcome. */
export interface CoverageScopeResult {
  scope: CoverageScopeRow['scope']
  response: APIResponse
}

// ============================================
// Coverage API Component
// ============================================

export class CoverageApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: Read the coverage of a workspace the caller cannot read - expects
   * the SAME empty-workspace answer, never real figures (200)
   *
   * Complete flow:
   * 1. GET /api/v1/workspaces/{id}/coverage for a workspace the caller has no
   *    active membership in (ACTION)
   * 2. Validate the response is the zeroed empty-workspace shape (fixed assertions)
   *
   * Non-disclosure contract: a foreign, nonexistent or lost-membership id
   * collapses into the same 200 an empty workspace returns, so the status
   * never confirms the workspace exists. The same assertions therefore hold
   * for any id the caller cannot read, which is why a test may call this ATC
   * with both a real foreign id and a nonexistent one. Counts are checked together because
   * the reserved foreign fixture has projects and modules but no acceptance
   * criteria: `project_count` and `modules_total` are the fields that expose a
   * leak there, the `ac_*` fields alone would not.
   *
   * @param workspaceId - Workspace id the caller cannot read: a real workspace they are NOT an active member of, or an id that does not exist
   * @returns Tuple with response and the coverage body
   */
  @atc('BK-872')
  async withholdCoverageFromForeignWorkspace(workspaceId: string): Promise<[APIResponse, WorkspaceCoverage]> {
    const [response, body] = await this.apiGET<WorkspaceCoverage>(`/workspaces/${workspaceId}/coverage`);

    // Fixed assertions - validates the empty-workspace shape, field by field
    expect(response.status()).toBe(200);
    expect(body).toEqual({
      ac_total: 0,
      ac_bound: 0,
      ac_executed: 0,
      ac_not_run: 0,
      ac_uncovered: 0,
      ac_coverage_percent: null,
      executed_coverage_percent: null,
      modules_total: 0,
      modules_fully_covered: 0,
      project_count: 0,
    });

    return [response, body];
  }

  /**
   * ATC: Read the workspace coverage under PATs of different scopes - expects
   * `atc:read` to pass (200) and an `atc:write`-only PAT to be rejected (403)
   *
   * Complete flow (once per row, each under its own PAT):
   * 1. GET /api/v1/workspaces/{id}/coverage with the row's PAT as Bearer (ACTION)
   * 2. Validate the gate's verdict for that scope (fixed assertions): the
   *    status derived from the scope (`atc:read` 200, `atc:write` 403), the
   *    coverage fields on a 200, and a message naming the missing `atc:read`
   *    capability on a 403
   *
   * Capability check is an exact-match membership test, so `atc:write` does
   * not substitute for `atc:read`. Each ATC assumes the PATs already exist: this
   * component never mints tokens. It swaps its own Bearer token per row and
   * restores the one it had when called, so the caller's identity is unchanged.
   *
   * Scope of the proof: the route answers 200 for ANY workspace id (a foreign
   * one gets the empty answer, see BK-872), so the 200 row proves the PAT
   * passes the gate, not that its owner belongs to `workspaceId`.
   *
   * @param args - Target workspace and the Examples rows
   * @param args.workspaceId - A workspace the PAT owner belongs to
   * @param args.rows - One row per scope: the scope and the PAT carrying it
   * @returns One result per row, in the same order
   */
  @atc('BK-873')
  async gateCoverageByPatScope(
    args: { workspaceId: string, rows: CoverageScopeRow[] },
  ): Promise<CoverageScopeResult[]> {
    const results: CoverageScopeResult[] = [];
    const savedToken = this.authToken;

    try {
      for (const row of args.rows) {
        this.setAuthToken(row.token);
        const [response, body] = await this.apiGET<WorkspaceCoverage | ErrorEnvelope>(`/workspaces/${args.workspaceId}/coverage`);

        // Fixed assertions - validates the gate's verdict for this scope
        expect(response.status(), `scope ${row.scope}`).toBe(COVERAGE_SCOPE_VERDICT[row.scope]);
        if (row.scope === 'atc:read') {
          expect(body).toMatchObject({
            ac_total: expect.any(Number),
            ac_bound: expect.any(Number),
            ac_executed: expect.any(Number),
            ac_not_run: expect.any(Number),
            ac_uncovered: expect.any(Number),
            modules_total: expect.any(Number),
            modules_fully_covered: expect.any(Number),
            project_count: expect.any(Number),
          });
          expect(body).toHaveProperty('ac_coverage_percent');
          expect(body).toHaveProperty('executed_coverage_percent');
        }
        else {
          expect(body, `scope ${row.scope}`).toMatchObject({ error: { message: expect.stringContaining('atc:read') } });
        }

        results.push({ scope: row.scope, response });
      }
    }
    finally {
      if (savedToken) { this.setAuthToken(savedToken); }
      else { this.clearAuthToken(); }
    }

    return results;
  }
}
