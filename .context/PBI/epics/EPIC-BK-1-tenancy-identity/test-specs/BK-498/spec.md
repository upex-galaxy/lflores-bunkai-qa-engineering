# BK-498: PAT capability-scope enforcement on the authoring domain

| Field | Value |
|-------|-------|
| **Priority** | 15 TCs — 3 Critical, 9 High, 3 Medium |
| **Phase** | Standalone (dependent on BK-497, already merged) |
| **Items** | 15 TCs — all `Candidate` (test-documentation verdict, 2026-08-21) |
| **Dependencies** | BK-497 (`TokensApi.mintPatWithScopes`, `AuthApi.authenticateSuccessfully`/`getCurrentUser`) |
| **Source** | Story: BK-498. TC bodies (Gherkin + preconditions + variables) already synced as canonical Jira `Test` issues — do NOT duplicate here, cite by path. |

## Summary

BK-498 flips 22 API handlers across 6 authoring-domain resource families (Modules,
User Stories, Acceptance Criteria, Environments, Milestones, Imports) from BK-497's
placeholder `{ auth: 'authenticated' }` posture to a real `requireCapability` gate
(`atc:read` on GET, `atc:write` on POST/PATCH/DELETE). Before this Story, any PAT —
regardless of scope — could create/edit/delete authoring content. These 15 TCs prove
the gate is wired correctly: right scope succeeds, wrong scope is rejected with 403
(not 401), absent/revoked credentials are rejected with 401 (not 403), workspace
non-membership is a distinct 403 reason from missing-capability, browser sessions are
never narrowed, and the Imports family's deliberate write/read scope split is a
ratified non-defect (2026-08-19 AI PO decision), not a wiring bug.

Sprint-testing (Stage 2/3) already executed all 15 outlines live against staging —
15/15 PASS (Engram `#216`). test-documentation (Stage 4) created the 15 Jira `Test`
issues as `Candidate` (Engram `#221`). This plan automates all 15.

## Test Cases — canonical source (do not re-derive)

Full Gherkin + preconditions + variable table for every TC lives in the synced Jira
`Test` issue cache — **read these before writing any ATC**, they are the contract:

`.context/PBI/epics/EPIC-BK-1-tenancy-identity/stories/STORY-BK-498-pat-enforce-capability-scopes-on-the-authoring-dom/test-cases/`

| Jira Key | TC | Priority | File |
|---|---|---|---|
| BK-556 | TC1: create module, `atc:write` | Critical | `BK-556-tc1-create-module-write-pat.md` |
| BK-560 | TC2: reject module create, `atc:read` | Critical | `BK-560-tc2-reject-module-read-pat.md` |
| BK-562 | TC3: create module, unbound `atc:write`, real member | High | `BK-562-tc3-create-module-unbound-write-pat.md` |
| BK-564 | TC4: list user stories, `atc:read` | High | `BK-564-tc4-list-user-stories-read-pat.md` |
| BK-565 | TC5: reject read, write-only PAT | Medium | `BK-565-tc5-reject-read-write-pat.md` |
| BK-567 | TC6: 401 unauthenticated (no header) | High | `BK-567-tc6-unauthenticated-401.md` |
| BK-569 | TC7: 403 `not_a_member` (membership vs capability) | High | `BK-569-tc7-reject-not-a-member.md` |
| BK-570 | TC8: default-scope PAT, write+read non-regression | High | `BK-570-tc8-default-scope-non-regression.md` |
| BK-557 | TC9: browser session bypasses PAT scope | Critical | `BK-557-tc9-browser-session-bypasses-pat-scope.md` |
| BK-558 | TC10: revoked token → 401, not 403 | Medium | `BK-558-tc10-revoked-token-401-vs-403.md` |
| BK-559 | TC11: reject writes, all families, `atc:read` (parametrized ×5) | High | `BK-559-tc11-reject-writes-atc-read-only.md` |
| BK-561 | TC12: accept writes, all families, `atc:write` (parametrized ×5) | High | `BK-561-tc12-accept-writes-atc-write-only.md` |
| BK-563 | TC13: accept reads, all families, `atc:read` (parametrized ×5) | High | `BK-563-tc13-accept-reads-atc-read.md` |
| BK-566 | TC14: reject reads, all families, `atc:write` (parametrized ×5) | High | `BK-566-tc14-reject-reads-atc-write-only.md` |
| BK-568 | TC15: full Imports lifecycle, dual-scope PAT (positive control) | High | `BK-568-tc15-full-import-lifecycle-dual-scope.md` |

## Preconditions (shared across all 15)

- Test user credentials in `.env` (`STAGING_USER_EMAIL`/`STAGING_USER_PASSWORD`) — same
  account `AuthApi.authenticateSuccessfully()` already establishes, member of
  `BK-264 QA Sandbox` workspace (`6646f244-a28c-441e-8486-9af33bdb5c11`).
- Target project `BK264 Defect Triage` (`2fee236f-1246-40c4-bfc4-d332287f9548`), existing
  module `Defect Triage Module` (`175f8a08-20b9-4c96-a21a-e02dcae2837e`) — same fixture
  IDs the Stage 2 execution used (Engram `#216`), staging-verified live.
- `WORKSPACE_NOT_MEMBER_ID` constant (`tests/data/constants.ts`, BK-497/BK-551) reused for
  TC7's non-member actor.
- PAT minting: `TokensApi.mintPatWithScopes({ scopes, workspace_id? })` (existing, BK-497)
  — covers every narrow-scope, unbound, and dual-scope PAT this plan needs.

## Merged TCs (if any)

None — all 15 TCs consumed verbatim; TC12/TC13/TC14 have an explicit, ATP-documented
data dependency (TC12's created rows are TC13/TC14's read fixtures) — this is a
sequential-composition-within-one-test decision, not a merge of TMS artifacts. See
`automation-plan.md` §5.

## Updated TCs (if any)

None.

## Acceptance Criteria

- [ ] 15 TCs automated across 2 new components (`ModulesApi`, `AuthoringSweepApi`)
- [ ] Every TC's exact status code + message/reason distinction preserved (401 vs 403,
      capability-403 vs membership-403 vs Imports-split-403)
- [ ] Parametrized sweep (TC11-14) implemented as 4 artifacts over 5 data rows each — not
      20 discrete ATCs (artifact-economy, doctrine Part 2.5)
- [ ] Tests pass on staging
- [ ] `bun run test`, `types:check`, `lint:check` all green; `kata-manifest.json` regenerated
