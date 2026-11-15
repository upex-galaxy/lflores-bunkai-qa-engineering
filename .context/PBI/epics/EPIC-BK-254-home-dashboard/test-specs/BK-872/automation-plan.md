# Test Automation Plan: BK-872

> Ticket: BK-872 (TC9 of Story BK-259) — integration, pure API
> Scope: bug-driven (Micro): one signed Candidate TC
> Created: 2026-11-15

## 1. Summary

- What to test: workspace coverage endpoint returns the empty-workspace answer to a non-member, with no existence echo.
- Source gate: BK-872 at `Candidate`, `Verdict signed:` comment dated 2026-11-15, before this run.
- Dependencies: none.

## 2. Architecture Decisions

| Decision | Value | Rationale |
|---|---|---|
| Component | NEW `CoverageApi.ts` | No component owns `/workspaces/{id}/coverage` (checked `kata-manifest.json`). BK-873 and BK-874 hit the same endpoint and will reuse it. |
| Fixture | `{ api }` | API only, no browser |
| Identity | `member` via `useIdentity` | Matches TC precondition. Verify in Code that it is provisioned and not a member of the foreign workspace. |
| Test file | `tests/integration/coverage/withholdCoverageFromForeignWorkspace.test.ts` | verb + Feature |
| Types | Facade export `WorkspaceCoverage` in `api/schemas/workspace.types.ts` | Generated type exists; no `api:sync` needed (contract verified current for this endpoint) |

## 3. ATC Registry

| ATC ID | Component | Method | Status |
|---|---|---|---|
| BK-872 | CoverageApi | withholdCoverageFromForeignWorkspace | NEW |

## 4. Files

| File | Action |
|---|---|
| `tests/components/api/CoverageApi.ts` | create |
| `tests/components/ApiFixture.ts` | register `coverage` (property, constructor, set/clearAuthToken) |
| `api/schemas/workspace.types.ts` | add `WorkspaceCoverage` facade |
| `tests/integration/coverage/withholdCoverageFromForeignWorkspace.test.ts` | create |
| `kata-manifest.json` | regenerate (`bun run kata:manifest`) |

## 5. Risks

- Fixture dependency: `WORKSPACE_NOT_MEMBER_ID` must keep its 2 projects / 2 modules. If emptied, the project and module fields stop discriminating a leak and the test passes without proof.
- `ac_*` fields cannot detect a leak (foreign workspace has 0 ACs). Assertions on `project_count` and `modules_total` carry the proof.
- The cached `member` identity may not exist for the staging env; `useIdentity` fails fast with an explicit message.

## 6. Test-Design Checklist

- [x] Every AC and risk traced to an ATC (AC silent on isolation; risk-beyond-AC covered)
- [x] EP partition named; boundary N/A (no range)
- [x] Parametrize same-behavior variants (real foreign id, nonexistent id) into one ATC
- [x] No ATC calls another ATC
