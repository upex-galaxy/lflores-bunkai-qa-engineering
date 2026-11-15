# Test Automation Plan: BK-873

> Ticket: BK-873 (TC10 of Story BK-259), integration, pure API
> Scope: bug-driven (Micro): one signed Candidate TC
> Created: 2026-11-15

## 1. Summary

- What to test: the coverage route admits an `atc:read` PAT (200) and rejects an `atc:write`-only PAT (403).
- Source gate: BK-873 at `Candidate`, `Verdict signed:` comment dated 2026-11-15, before this run.
- Dependencies: reuses `CoverageApi` and the `WorkspaceCoverage` facade from BK-872.

## 2. Architecture Decisions

| Decision | Value | Rationale |
|---|---|---|
| Component | EXTEND `CoverageApi.ts` | Same endpoint; no new class |
| ATC shape | one data-driven ATC over rows | One TC, two examples with different outcomes; mirrors BK-673/674 |
| Fixture | `{ api }` | API only |
| Identity | `member` via `useIdentity(..., { withSession: true })` | TC precondition; session needed to mint PATs |
| PAT hygiene | mint with short expiry, revoke in `finally` | Do not leave tokens in shared staging |
| Test file | `tests/integration/coverage/gateCoverageByPatScope.test.ts` | verb + Feature |

## 3. ATC Registry

| ATC ID | Component | Method | Status |
|---|---|---|---|
| BK-873 | CoverageApi | gateCoverageByPatScope | NEW |

## 4. Files

| File | Action |
|---|---|
| `tests/components/api/CoverageApi.ts` | add row/result types and the ATC |
| `tests/integration/coverage/gateCoverageByPatScope.test.ts` | create |
| `kata-manifest.json` | regenerate |

## 5. Risks

- Resolved on the first run: `member` CAN mint an unbound `atc:write` PAT (the server only role-gates `workspace:admin` or a workspace binding).
- Revoking a PAT is cookie-only; the revoke runs with the session cookie and without the PAT as ambient Bearer.
- If a revoke fails the PAT stays live in staging for up to 1 day (the API minimum expiry). Mitigation after judgment-day round 1: both mints sit inside the `try`, each revoke is isolated and its 204 checked, and a failed cleanup fails the test.
- Depends on BK-872 for `CoverageApi`, the `WorkspaceCoverage` facade and the `ApiFixture` wiring. BK-872 must land first or in the same change.

## 6. Test-Design Checklist

- [x] Risk traced to an ATC (authorization is risk-beyond-AC)
- [x] Decision-table rules both covered (atc:read, atc:write)
- [x] Same-behavior variants parametrized (rows), different outcomes kept in one TC by its design
- [x] No ATC calls another ATC
