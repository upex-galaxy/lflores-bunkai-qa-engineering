# ATC Spec: BK-873 — gateCoverageByPatScope

> Ticket: BK-873 (Story BK-259, TC10)
> Component: CoverageApi (tests/components/api/CoverageApi.ts) — EXTENDED (created by BK-872)
> Type: API — Authorization (capability scope gate), data-driven by rows

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| gateCoverageByPatScope | Prove the coverage route admits `atc:read` and rejects `atc:write`-only | One PAT per scope, owned by a workspace member | atc:read -> 200 with coverage shape; atc:write -> 403 naming `atc:read` |

## 2. ATC Contract

```typescript
/**
 * ATC: GET /api/v1/workspaces/{id}/coverage once per row, each row under its own PAT.
 * Fixed assertions per row:
 *  - status derived from the row's scope: `atc:read` 200, `atc:write` 403
 *  - 200: body carries the workspace-coverage fields
 *  - 403: error message names the missing `atc:read` capability
 * The ATC restores the component's previous Bearer token when it returns.
 */
@atc('BK-873')
async gateCoverageByPatScope(
  args: { workspaceId: string, rows: CoverageScopeRow[] },
): Promise<CoverageScopeResult[]> { /* ... */ }
```

`CoverageScopeRow = { scope: 'atc:read' | 'atc:write', token: string }`. The expected status is the ATC's own invariant (derived from the scope), not caller input: a mislabeled row cannot make the test pass against an ungated route (judgment-day round 1, 2026-11-15).

## 3. API Details

| Aspect | Value |
|---|---|
| Endpoint | `GET /api/v1/workspaces/{id}/coverage` |
| 200 body | `WorkspaceCoverage` (facade already added by BK-872) |
| 403 body | `ErrorEnvelope`, message contains `atc:read` (same assertion as BK-674) |
| Auth | Bearer PAT per row; the ATC sets the component token before each call |
| Contract source | Live staging OpenAPI compared to local on 2026-11-15: operation identical, responses 200/400/401/403/500 |

## 4. Assertions Split

### Fixed (inside ATC)
- Per row: status derived from the scope (`atc:read` 200, `atc:write` 403).
- 200 row: `ac_total`, `ac_bound`, `ac_executed`, `ac_not_run`, `ac_uncovered`, `modules_total`, `modules_fully_covered`, `project_count` are numbers; both percentages are present (number or null).
- 403 row: body matches `{ error: { message: contains 'atc:read' } }` (a body without `error` fails as an assertion, not a TypeError).

What the 200 proves: the PAT passes the gate. The route answers 200 for any workspace id (a foreign one gets the empty answer, BK-872), so the 200 does not prove the owner belongs to `workspaceId`.

### Test-level (in test file)
- Every minted PAT was revoked: each revoke returns 204 (`DELETE /tokens/{id}` contract). Asserted after the `finally`, so a failed cleanup fails the test instead of passing silently.
- Preconditions (mint two PATs inside the `try`, discover the workspace) live in the test.

## 5. Technique-derivation check

| Source | Technique | ATCs produced |
|---|---|---|
| ATP row TC10, Error Guessing / auth | Decision table on scope (2 rules), EP: each scope is its own partition | 1 data-driven ATC, 2 rows |

Floor vs ceiling: the AC is silent on authorization; this is risk-beyond-AC. Already covered elsewhere and not repeated: extra unrelated scope is inert (BK-676), session bypasses the gate (BK-681), zero-scope PAT cannot be issued (BK-672).

## 6. Data Context

| Precondition | Pattern | Source | Cleanup |
|---|---|---|---|
| Two scoped PATs | Generate | `api.tokens.mintPatWithScopes` under the member session, unbound | Revoke both in `finally` |
| A workspace the member belongs to | Discover | `api.auth.getCurrentUser()` first workspace | None |

## 7. Checklist

- [x] `verb{Resource}{Scenario}` naming
- [x] Max 2 positional params (1 object)
- [x] Not duplicating an ATC: checked against `kata-manifest.json` before coding; `bun run kata:manifest:check` proves it stays registered once
- [x] No ATC calls another ATC
