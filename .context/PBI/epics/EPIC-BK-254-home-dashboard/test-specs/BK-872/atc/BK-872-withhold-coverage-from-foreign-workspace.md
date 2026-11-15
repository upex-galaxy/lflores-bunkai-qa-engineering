# ATC Spec: BK-872 — withholdCoverageFromForeignWorkspace

> Ticket: BK-872 (Story BK-259, TC9)
> Component: CoverageApi (tests/components/api/CoverageApi.ts) — NEW component
> Type: API — Negative (Error Guessing / security, non-disclosure)

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| withholdCoverageFromForeignWorkspace | Prove a non-member reading another workspace's coverage gets the empty-workspace answer | Authenticated `member`, a workspace id the caller cannot read (foreign or nonexistent) | 200 with zeroed counts and null percentages |

## 2. ATC Contract

```typescript
/**
 * ATC: GET /api/v1/workspaces/{id}/coverage for a workspace the caller cannot read
 * (a real workspace they are not an active member of, or an id that does not exist).
 * Fixed assertions:
 *  - 200 (never 403/404: the status must not confirm the workspace exists)
 *  - every count is 0 and both percentages are null (empty-workspace shape)
 */
@atc('BK-872')
async withholdCoverageFromForeignWorkspace(
  workspaceId: string,
): Promise<[APIResponse, WorkspaceCoverage]> { /* ... */ }
```

## 3. API Details

| Aspect | Value |
|---|---|
| Endpoint | `GET /api/v1/workspaces/{id}/coverage` |
| Response type | `WorkspaceCoverage` (`components['schemas']['WorkspaceCoverage']`, already in `api/openapi-types.ts`; add a facade export in `api/schemas/workspace.types.ts`) |
| Auth | `member` cached PAT (Bearer) via `useIdentity(api, 'member')`; needs `atc:read`, which the cached PAT carries |
| Contract source | Live staging OpenAPI compared to local `api/openapi.json` on 2026-11-15: operation and schema identical |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 200`
- `ac_total`, `ac_bound`, `ac_executed`, `ac_not_run`, `ac_uncovered`, `modules_total`, `modules_fully_covered`, `project_count` all `0`
- `ac_coverage_percent === null` and `executed_coverage_percent === null`

### Test-level (in test file)
- None. The test calls the ATC for `WORKSPACE_NOT_MEMBER_ID` and for a random UUID. Each call is held to the same fixed assertions, which already proves the two answers are indistinguishable. A deep-equal between the two bodies was removed after judgment-day round 1 because it could never fail on its own.

## 5. Technique-derivation check

| Source | Technique | ATCs produced |
|---|---|---|
| ATP row TC9, Error Guessing / security | Error Guessing (non-disclosure), EP: real-foreign id and nonexistent id are one partition ("caller cannot read this workspace") | 1 parameterized ATC, called with 2 values |

Floor vs ceiling: the AC (coverage percentage) is silent on isolation; this TC is risk-beyond-AC.
Not added (out of this TC): viewer role, lost-membership state. Candidates for a later TC.

## 6. Data Context

| Precondition | Pattern | Source | Cleanup |
|---|---|---|---|
| Foreign workspace with real content | Discover | `WORKSPACE_NOT_MEMBER_ID` in `tests/data/constants.ts` (reserved fixture) | None, read-only |
| Nonexistent workspace | Generate | `randomUUID()` from `node:crypto` | None |

## 7. Checklist

- [x] `verb{Resource}{Scenario}` naming
- [x] Max 2 positional params (1)
- [x] Tuple return `[APIResponse, TBody]`
- [x] Fixed vs test-level split
- [x] Not duplicating an ATC: no `BK-872` in `kata-manifest.json`
