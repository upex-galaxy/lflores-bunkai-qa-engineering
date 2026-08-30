# BK-499: PAT | Enforce capability scopes on read, identity and notification routes

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Phase** | Standalone (third and final slice of the BK-262 split; BK-497/BK-498 already merged) |
| **Items** | 15 TCs (2 are parametrized Scenario Outlines covering 4 and 2 routes respectively) |
| **Dependencies** | None — BK-497 (capability-posture machinery) and BK-498 (authoring-domain routes) already shipped and automated |
| **Requires** | Staging test-user creds (`.env`), a workspace the test user owns/is-member/is-viewer of (Discover or Generate at runtime — see automation-plan.md §4), zero pre-seeded fixtures otherwise |
| **Source** | Story: BK-499, QA Approved via `/sprint-testing` (2026-08-27), documented via `/test-documentation` Stage 4 (2026-08-28) |

## Summary

BK-499 is a mechanical capability-posture sweep across 24 API handlers (14 `atc:read` reads, 1 `atc:write` write, 2 session-only routes, 7 no-capability identity/notification routes). The 15 TCs don't test each handler's business logic — they prove the **capability gate itself** behaves uniformly: correctly-scoped PATs pass, incorrectly-scoped PATs are rejected with the right message, workspace role never substitutes for a missing capability, and the gate runs before any downstream membership/RLS check. One TC (TC9/BK-679) is a known regression check for an **open, unfixed defect** (BK-623) — it will fail red until BK-623 ships; this is intentional per the bug-driven golden rule (the TC that found the bug becomes its permanent regression check).

## Test Cases

> Bodies live in Jira. Synced copies sit under `../../stories/STORY-BK-499-pat-enforce-capability-scopes-on-read-identity-and/test-cases/`.

| TMS ID | Title | Type | Priority |
|--------|-------|------|----------|
| BK-671 | should create workspace given PAT holds at least one scope | Positive (bootstrap) | Critical |
| BK-672 | should reject token issuance given zero scopes requested | Negative (validation) | Medium |
| BK-673 | should return 200 with data given PAT scoped atc:read | Positive, parametrized (4 routes) | Critical |
| BK-674 | should return 403 given PAT missing atc:read | Negative, parametrized (4 routes) | Critical |
| BK-675 | should reject given PAT scoped atc:write only on a read-gated route | Negative (boundary) | Critical |
| BK-676 | should pass given PAT holds required scope plus an unrelated extra scope | Positive (boundary) | Low |
| BK-677 | should succeed for any authenticated PAT regardless of scope given identity/notification route | Positive, parametrized (2 routes) | Medium |
| BK-678 | should reject Bearer PAT on DELETE workspace membership | Negative (session-only) | Critical |
| BK-679 | should reject Bearer PAT on POST active-workspace with the browser-session message | Negative (session-only) — **KNOWN FAILING, blocked by BK-623** | Critical |
| BK-680 | should succeed via browser session on session-only routes | Positive, parametrized (2 routes) | Medium |
| BK-681 | should serve a capability-gated route to a browser session with no scope check | Positive (Business Rule 2) | Critical |
| BK-682 | should reject owner-role PAT missing required capability | Negative (Business Rule 1) | Critical |
| BK-683 | should accept viewer-role PAT holding required capability | Positive (Business Rule 1, converse) | Medium |
| BK-684 | should create project given PAT scoped atc:write and member role | Positive (write path) | Medium |
| BK-685 | should reject given PAT missing atc:write checked before membership | Negative (gate-ordering invariant) | Critical |

## Automation Plan

**Order**: BK-671 first (bootstrap — proves `mintPatWithScopes`'s underlying workspace-creation path works and needs zero pre-existing data). BK-672 second (also zero-dependency, pure validation). Then the `CapabilityGateApi` cluster (BK-673/674/675/676/677/681/682/683) together since they share one new component. Then the session-only cluster (BK-678/679/680) since they share `WorkspaceApi` extensions. BK-684/685 last (new `ProjectsApi`, needs a real workspace membership to seed against).

**Shared fixtures**: `{ api }` for all 15 — this Story never touches the UI. All 15 reuse `TokensApi.mintPatWithScopes()` (existing helper) as the PAT-minting precondition. `AuthApi.authenticateSuccessfully()` establishes the cookie session + workspace membership every test needs as its base identity.

**Blocked by**: BK-679 (TC9) is expected to fail — tracked as `@blocked:BK-623` per the G2 failure protocol, not a coding error. Nothing else blocks.

**Preconditions for the whole scope**: a staging test-user identity that can authenticate (`.env` creds), and at least one workspace that identity owns or is a member of. Per Data Strategy (automation-plan.md §4), each test Discovers or Generates its own workspace/project/test-run context — no hardcoded QA-sandbox IDs from the manual QA session are reused in code.

## Acceptance Criteria

- [ ] 15/15 TCs automated (14 green, 1 red-by-design tied to BK-623)
- [ ] Tests pass on local and staging
- [ ] `kata-manifest.json` regenerated and clean after all components land
