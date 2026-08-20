# Test Session Memory: BK-497

> Shared memory across sub-agents. Each stage updates its section.
> Last updated: 2026-08-19 by Session Start

## Ticket
- ID: BK-497
- Title: PAT | Require every API route to declare its capability posture
- Type: Story
- Priority: Medium
- Story Points: 5
- Dev: Luis Eduardo Flores Villarroel (implementing dev per PR #182; also QA assignee)
- Reporter: Ely
- Project: Bunkai (BK)
- Platform: Backend / API (Next.js route handlers)
- Sprint: n/a (not sprint-tagged in synced story.md)
- Status: Ready For QA
- Labels: shift-left-2026-08-14, shift-left-reviewed
- Epic: BK-1 (Tenancy & Identity)
- Provenance: split (Foundation slice) from BK-262 (ABORTED, split not abandoned) per 2026-08-17 AI Product Owner / AI Tech Lead ruling; siblings BK-498 (Ready For Dev) and BK-499 (Backlog) depend on this Story

## Story Explanation
BK-497 is a foundation-level security hardening Story in the Tenancy & Identity epic. Today, an API route handler in Bunkai can be written without explicitly stating who is allowed to call it — a developer could accidentally ship a new route with no auth check at all, and nothing would stop them. This Story closes that gap at the type level: it changes the shared route-handler type so that declaring an authentication/capability posture (`public`, `cookie-only`, `authenticated`, or `required` with specific capabilities) becomes mandatory — a route with no posture literally fails to compile. All 87 existing route handlers across 68 files were migrated to this new shape, and a coverage check was added that walks every route file on disk and fails if a new one appears without a declared posture.

Critically, this Story is explicitly BEHAVIOUR-NEUTRAL by design: no new capability gate was turned on for any of the 50 currently-unprotected routes (that is deliberately left to two follow-up Stories, BK-498 and BK-499), and there is no database migration. So for QA, the central question is not "does a new rule work" — it is "did anything regress". The one deliberate exception is a real behavioural change: the two token-management routes (issue / revoke a PAT) had their hand-written rejection logic lifted into the shared gateway as a first-class `cookie-only` posture, and that specific change needs explicit verification, including the dev-suggested manual smoke of issuing and revoking a PAT from Settings.

## Acceptance Criteria
1. **AC-04 (BK-262 numbering)** — A token scoped only for reads is rejected creating an invite: given Karim holds a PAT scoped exactly `atc:read`, when he sends a request to invite a new member using that token, then he receives 403 and no invite is created.
2. **AC-05 (BK-262 numbering)** — A token with unrelated scopes is rejected on a workspace-admin action: given Karim holds a PAT scoped `atc:write` + `run:execute` (no `workspace:admin`), when he sends a request to revoke a pending invite using that token, then he receives 403 and the invite is unchanged.
3. **AC-06 (BK-262 numbering)** — A token with no resolvable workspace context is rejected on a workspace-admin action: given Karim holds a PAT scoped `workspace:admin` not bound to any workspace, when he sends a request to update workspace settings using that token, then he receives an error indicating the workspace could not be resolved and no action is taken.

> Note synced from Jira: AC-04/05/06 already pass against today's code — they are **non-regression guards** on the all-call-site migration this Story performs, not new behaviour. This is the only Story that touches all 87 call sites, so it is the only one that can break them; they must not be treated as "already green, skip".

> See `context.md` § Open Questions #1 — the Story's headline property ("a route with no posture fails to compile") has no acceptance criterion of its own among these three; it is tested but never stated as a criterion. Flagged by the AI Product Owner's split ruling, carried forward for Stage 1 Test Analysis.

## Team Discussion
(Full detail in `context.md` § Team Discussion — source `comments.md`. Summary:)
- **PR lifecycle (bot comments):** PR created → merged + deployed to staging. Dev task Done.
- **Ely, QA handoff (2026-08-18):** Assigns Luis as QA owner. PR #182 merged to `staging`, merge commit `ce9a38d7`. Explicitly behaviour-neutral by design — no capability assigned to any previously-ungated route, no gate changed, no DB migration. Framed the QA question as "is everything still exactly as it was", not "does a new rule work".
- **Evidence provided by dev:** Full suite 1555 pass / 1 fail (the 1 failure is pre-existing/unrelated — `lib/runs/start-run.test.ts:129`, BK-34, identical on untouched `staging` tip). Types clean, lint 0 errors. AC-04/05/06 genuinely exercised (not skipped) — all four Supabase credentials were present in this run, so the credential-gated suites (`rls-parity`, `auth-coexistence`, `workspace-context`, `pat`) ran with zero skips across 17 tests.
- **The one real behavioural change:** hand-rolled bearer rejection on the two token routes lifted into the gateway as a `cookie-only` posture. Proven by `app/api/v1/tokens/cookie-only-posture.test.ts` driving the real exported handlers with a real minted token: POST `/tokens` and DELETE `/tokens/{id}` return 403 with pre-lift messages preserved verbatim; DB confirms no token minted / target token still unrevoked; GET `/tokens` with the same token returns 200 as the positive control.
- **Dev-suggested manual smoke:** issue a PAT from Settings, and revoke one — the only two user-facing paths whose enforcement moved.
- **Findings flagged for BK-499's shift-left, out of BK-497 scope:** two bare gateway-free handlers outside `app/api` (`app/auth/callback/route.ts`, `app/auth/oauth/[provider]/route.ts`), and `POST /invites/accept`'s open deferred-debt posture question.

## Environment
- Web: https://staging-upexbunkai.vercel.app | API: https://staging-upexbunkai.vercel.app/api/v1
- WEB_URL_OVERRIDE: none
- API_URL_OVERRIDE: none
- DB MCP: staging-dbhub | API MCP: staging-openapi
- active_env: staging (project.yaml testing.default_env; reachability already confirmed by orchestrator)

## Test Data
Confirmed feasible per Stage 1 Phase 0.3 data-feasibility check (see ATP). Generate all PATs live via `POST /api/v1/tokens` (session-authenticated) unless noted:
- AC-04 (TC-01): PAT scoped exactly `atc:read` — Generate.
- AC-05 (TC-02): PAT scoped `atc:write`+`run:execute`, no `workspace:admin` — Generate.
- AC-06 (TC-03): PAT scoped `workspace:admin`, unresolvable workspace binding — **Discover first** against GAP-14's ~136 residual pre-fix admin-scoped PATs on staging (`business-api-map.md`); **Generate/Modify fallback** = mint a workspace-bound admin PAT then remove the caller's membership from that workspace.
- TC-04 positive control: PAT scoped `workspace:admin`, correctly bound — Generate.
- Cookie-only lift (TC-10-13): any valid minted PAT (channel-based rejection, scope-irrelevant) + an active staging session — Generate/Discover.
- Manual smoke (TC-14/15): active staging session with Settings access — Discover (already have one).
- Compile-time outlines (TC-05-09): no runtime data — scratch TypeScript fixture only, not committed to `app/api`.
- Cleanup: revoke every PAT minted for this ATP's execution at the end of Stage 2.

## Repositories
- Backend: /home/lflores/proyectos/cursos/dojo3/upex-bunkai-tms (Next.js + Supabase + Vercel, entry `.`)
- Frontend: /home/lflores/proyectos/cursos/dojo3/upex-bunkai-tms (Next.js, entry `.`) — same repo, monolith

## Code Locations
### Backend (upex-bunkai-tms)
- `lib/api/handler.ts` — `WithApiHandlerOptions` discriminated union (`public` / `cookie-only` + `why` / `authenticated` + `why` / `required` + `requires: NonEmpty<Capability>`); `options` loses its `= {}` default so `auth` is mandatory. The durable, type-level part of this Story.
- `lib/api/pat.ts:12` — `AccessTokenScope`, consolidated into the single `ALL_CAPABILITIES` vocabulary (moved to a new neutral `lib/api/capabilities.ts`, re-exported from `principal.ts` and `pat.ts` per Technical Decision D1).
- `lib/api/principal.ts:31` — `ALL_CAPABILITIES` (now a re-export of the neutral module).
- `lib/api/principal.ts:10` — `server-only` import boundary; the reason the consolidated vocabulary could not live directly in `principal.ts` (would break the client bundle for `IssueTokenModal.tsx`).
- `app/api/v1/tokens/route.ts:36` and `app/api/v1/tokens/[id]/route.ts:21` — the `cookie-only` lift: hand-rolled `principal.via === 'bearer'` rejection moved into the gateway, preserving each route's original 403 message verbatim via the new `why` field.
- `app/api/v1/tokens/route.ts:111` — `GET /api/v1/tokens`, given `{ auth: 'authenticated', why: 'Listing is read-only and RLS-scoped to the caller's own tokens.' }` — explicitly NOT the `cookie-only` lift.
- `lib/api/route-capability-coverage.test.ts` — the coverage check; walks `app/api/**/route.ts`, extracts every exported handler + posture, diffs against the committed snapshot.
- `lib/api/route-capability-coverage.snapshot.json` — committed snapshot enumerating all 87 handlers and their postures, including the 2 bypassers under an explicit `bypass` posture.
- `app/api/openapi/route.ts:18` and `app/api/v1/route.ts:21` — the two gateway bypassers (bare `export function GET` force-static; bare `export function OPTIONS` static 204 CORS preflight), explicitly enumerated by the coverage check so it cannot claim false completeness.
- `app/api/v1/tokens/cookie-only-posture.test.ts` — the new behavioural test proving the `cookie-only` lift (real handlers, real minted token, positive + negative controls, DB-confirmed no-op on the 403 paths).
### Frontend (upex-bunkai-tms)
- `components/settings/IssueTokenModal.tsx` — `'use client'` component importing `ALLOWED_PAT_SCOPES` (value) + `AccessTokenScope` (type) from `@lib/api/pat`; the client-safety constraint that drove Technical Decision D1 (neutral `capabilities.ts` module instead of importing from `server-only` `principal.ts`). Relevant to the manual smoke (issue/revoke a PAT from Settings) but not itself modified in scope per the synced fields.
### Database (Supabase Postgres)
- `supabase/migrations/0008_access_tokens.sql:34-36` — the scope-vocabulary CHECK constraint; re-confirmed untouched (no new scope value introduced, no migration in this Story).
- No RPC changes — dev's implementation plan confirms the RPC-authorization gate was assessed but not engaged (no Postgres function touched, no function taking a caller-supplied identity/scope parameter added).

## TMS Artifacts
| Type | ID | Name | Status |
|------|----|------|--------|
| ATP  | Story field `customfield_10067` (🧪 Acceptance Test Plan) | ATP: BK-497: PAT \| Require every API route to declare its capability posture | Written, synced, confirmed |
| ATR  | Story field `customfield_10124` (🧪 Acceptance Test Results) | ATR: BK-497 TEST RESULTS — PASSED WITH ISSUES (15/17) | Written, synced, confirmed |
| TC   | -  | -    | n/a — jira-native defers TC creation to Stage 4, regression-worthy outlines only |
| Improvement | BK-542 | BK-1: PAT/API Auth: route-capability-coverage.test.ts crashes ungracefully when auth options are fully omitted | Open — parented to QA Defect Management (BK-183), linked to BK-497 via Problem/Incident (causes), components: Tenancy & Identity, priority Low, QA Assignee self |

## Paths
- PBI: .context/PBI/epics/EPIC-BK-1-tenancy-identity/stories/STORY-BK-497-pat-require-every-api-route-to-declare-its-capabil/
- Module Context: .context/PBI/epics/EPIC-BK-1-tenancy-identity/module-context.md (not yet checked/created this session — Stage 1 to confirm existence before full code exploration)

## Stage Results
### Session Start
Completed 2026-08-19. Read all seven Jira-synced files (story.md, acceptance-criteria.md, business-rules.md, scope.md, out-of-scope.md, comments.md, implementation-plan.md — already freshly synced via `bun run jira:sync-issues get BK-497 --include-comments`, not re-run here). Loaded project-wide context (master-test-plan.md, business-data-map.md, business-feature-map.md, business-api-map.md) and confirmed BK-497 sits inside the CRITICAL-tier Auth/PAT risk surface already tracked in master-test-plan.md (prior PAT-scope incidents: member-role self-escalation, Bearer-ignoring-workspace-switch — both fixed; GAP-14 residual risk: ~136 pre-fix admin-scoped PATs never confirmed revoked, unrelated to this Story's scope but same risk tier). Created hand-authored `context.md` (session notes + Open Questions) and this `test-session-memory.md`. Created empty `evidence/` directory. Did not touch any Jira-mirrored file. No Jira writes performed (read-only session-start).

### Planning
Completed 2026-08-19. Veto n/a (Story — skipped the veto/triage decision tree per briefing). Shift-Left short-circuit applied (label `shift-left-reviewed` dated 2026-08-14, < 30 days old) — Phases 1-3 reused from BK-262, continued from Phase 4 with executable detail per `acceptance-test-planning.md`. Risk score 7/MEDIUM-HIGH (dynamic-data +3, explicit-ACs +2, high-priority/CRITICAL-tier +1, multi-component +1; user-facing and new-feature both scored 0 given the Story's "no behaviour change" DoD on 86/87 handlers) → Full ATP, weighted toward regression risk over new-behaviour risk. Applied the three QA-owner decisions: (1) added Scenario D / TC-05-09 for the headline "missing posture fails to compile" property (no Jira AC exists for it — logged as an AC Gap, not invented as a criterion); (2) added Scenario F / TC-14-15 manual smoke (issue+revoke a PAT from Settings); (3) excluded the two bare non-`app/api` handlers and the `POST /invites/accept` deferred-debt item (both BK-499's shift-left scope). Produced 17 test outlines across a Decision Table (AC-04/05/06 + positive control), 5 structural/compile-time outlines (BVA on the `NonEmpty<Capability>` boundary + coverage-check granularity), a parametrized cookie-only-lift group (4 rows, one artifact per test-design-doctrine Part 2.5), 2 manual-smoke outlines, and 2 Error Guessing charters (auth-resolution ordering; bounded regression spot-check across the 4 posture types). State-Transition and Pairwise both logged N/A with reasons (no state machine touched; ≤3 hand-picked factors fully covered by the Decision Tables already). Data feasibility checked for every AC — none blocked; AC-06's "unresolvable workspace" precondition has a Discover-first path (GAP-14 residual orphaned admin PATs) with a Generate/Modify fallback always available. Wrote the ATP body (Markdown → ADF via `scripts/md-to-adf.ts`, validated, then pushed via the REST `PUT /rest/api/3/issue/BK-497` workaround since `acli workitem edit` rejects custom-field input on existing items) to the Story's `customfield_10067` (🧪 Acceptance Test Plan) field — HTTP 204 confirmed. `shift-left-reviewed` label already present from the shift-left pass, not re-added. No `Test` work items created (jira-native defers TC creation to Stage 4). Materialized via `bun run jira:sync-issues get BK-497 --include-comments` (1 file created: `acceptance-test-plan.md`, 7 updated) and read back to confirm all sections landed intact.

### Execution
Completed 2026-08-19. Transitioned BK-497 `Ready For QA` → `In Test` via `acli jira workitem transition --key BK-497 --status "In Test"` (transition id 9, `start_testing`). Self-assigned QA ownership: `customfield_10070` (QA Assignee) was empty (read-before-write confirmed), set to the authenticated acli session user (Luis Eduardo Flores Villarroel) via the REST `PUT /rest/api/3/issue/BK-497` workaround — HTTP 204.

**Smoke pass (PASSED, ~6 min).** TC-04 (correctly-scoped bound admin PAT → PATCH workspace → 200), TC-12 (any-scope PAT → GET /tokens → 200), TC-13 (session cookie → POST/GET/DELETE /tokens → 201/200/204) all passed on first attempt. Go decision taken; proceeded to deep triforce.

**Test data minted.** Established a cookie session via `POST /api/v1/auth/signin` with a curl cookie jar (session cookies ARE set on that response per the route's own doc comment — confirmed empirically), then minted all test PATs through cookie-authenticated `POST /api/v1/tokens` (issuance is `cookie-only` by design, so Bearer-token minting was never an option). All minting used the `BK-264 QA Sandbox` workspace (`6646f244-a28c-441e-8486-9af33bdb5c11`), where STAGING_USER is the sole owner — discovered via `GET /api/v1/me`.

**Triforce API/DB — 15 of 17 TCs run live, all PASSED:**
- TC-01 (AC-04): `atc:read`-only PAT → `POST /workspaces/{id}/invites` → 403 `"Missing required capability: workspace:admin"`. DB: zero `workspace_invites` rows for the target email. PASSED.
- TC-02 (AC-05): `atc:write`+`run:execute` PAT (no admin) → `DELETE /workspaces/{id}/invites/{inviteId}` on a real pre-created pending invite → 403 same missing-capability message. DB: invite row unchanged (`revoked_at` still null). PASSED.
- TC-03 (AC-06) — **BLOCKED, substitute run instead — see Observations.**
- TC-04: correctly-scoped bound admin PAT → `PATCH /workspaces/{id}` → 200, workspace updated. PASSED (also the smoke positive control).
- TC-10: Bearer PAT → `POST /tokens` → 403 `"Personal access tokens cannot issue tokens. Use a browser session."` (verbatim pre-lift message). DB: zero rows for the attempted token name. PASSED.
- TC-11: Bearer PAT → `DELETE /tokens/{id}` (target = TC-02's own token) → 403 `"Personal access tokens cannot revoke tokens. Use a browser session."` DB: target token's `revoked_at` still null. PASSED.
- TC-12: Bearer PAT → `GET /tokens` → 200. PASSED (also smoke).
- TC-13: session cookie → issue (201) / list (200) / revoke (204) all three token routes. PASSED (also smoke).
- TC-16: invalid/garbage Bearer token → `POST /tokens` → **401** `"Invalid token."`, not 403 — confirms `resolveIdentity` (identity resolution) runs and fails BEFORE the `cookie-only` posture check, exactly the ordering the ATP set out to prove. PASSED.
- TC-17: 3-route spot-check across posture types not otherwise exercised — `public` (`GET /health` → 200), `authenticated`/no-capability (`GET /workspaces/{id}` via session → 200), `required:atc:read` (`GET /workspaces/{id}/recent-projects` via `atc:read` PAT → 200). All matched pre-migration baseline expectations. PASSED.

**TC-03 (AC-06) — BLOCKED, environment/data-access limitation, not a product defect.** The exact precondition ("a PAT scoped `workspace:admin`, **not bound to any workspace**") cannot be reproduced live this session:
1. Minting such a token directly is blocked by design — `assertTokenIssuanceAuthorized` in `lib/api/pat.ts` throws `forbidden` when `wantsAdmin && !workspaceId` (this is BK-135/ADR-0005's own closed gap — the very thing that makes the legacy state rare).
2. The DB MCP role (`qa_inspector_ro`, confirmed via `has_table_privilege`) is strictly read-only — cannot null out a minted token's `workspace_id` to simulate the legacy state.
3. Discover found 10 live GAP-14 residual candidates (`workspace:admin` scope, `workspace_id IS NULL`, unrevoked) via direct SQL — but only the SHA-256 hash is stored (`access_token_secrets`), never the raw secret, so a discovered row cannot actually be used to authenticate a request.
4. The Generate+Modify fallback described in the ATP ("mint bound, then remove membership") does not reach the same code path even if executable: removing STAGING_USER's own membership in `bk264-qa-sandbox` is blocked server-side (`DELETE /workspaces/{id}/membership` refuses when the caller is the workspace's only active owner — true here), and no alternate identity with `admin` (non-owner) role + a second active membership was available among the configured `.env` accounts (STAGING_USER/MEMBER/VIEWER) to route around it. No member-role-update endpoint exists in the API surface either.

**Mitigation run instead:** the closely-related `assertWorkspaceContext` branch — an admin-scoped PAT **bound to workspace A** used against **workspace B** — was exercised live: `PATCH /workspaces/{other-workspace}` with the `bk264-qa-sandbox`-bound TC-04 admin PAT → 403 `"This token is scoped to a different workspace."` This proves the sibling half of the same guard function fires correctly, but it is explicitly **not** AC-06's literal "unbound token" scenario — logged as a partial/substitute check, not full AC-06 coverage. AC-06's exact scenario was already verified by the dev's own automated `workspace-context` suite (0 skips) per the dev's Jira evidence — this is a live-reproduction gap for THIS QA pass only, not an unverified product behaviour.

**Structural/compile-time TC-05–TC-09 (Option A, scratch fixtures) — all PASSED except one finding on TC-08:**
- TC-05/TC-05b/TC-06/TC-07: one scratch file `.scratch-typecheck-bk497/posture-fixture.ts` (backend repo root, NOT under `app/api`) with 4 `@ts-expect-error`-guarded `withApiHandler(...)` calls (missing `auth` entirely / empty options `{}` / `requires: []` / invalid capability literal) plus one positive-control call. `bunx tsc --noEmit` (run from backend repo root) reported **zero errors on any line of the fixture** — every `@ts-expect-error` found a real error to suppress (confirming the compiler does reject each case) and the positive control compiled clean. (The full repo run did surface 12 pre-existing `error TS2307: Cannot find module` errors in unrelated files — `shiki`, `react-markdown`, `@dnd-kit/*` — a local-checkout dependency-install gap, not a BK-497 regression; noted, not investigated further as out of scope.) PASSED.
- TC-09: ran the existing, unmodified `lib/api/route-capability-coverage.test.ts` via `bun test` → 6 pass / 0 fail / 82 expect() calls. PASSED.
- TC-08: created a throwaway two-handler route file `app/api/v1/_bk497_scratch_tc08_delete_me/route.ts` (compliant `GET` + a `POST` calling `withApiHandler(handler)` with the options argument fully omitted), ran `bun test lib/api/route-capability-coverage.test.ts` against it. **Result: the whole test file crashed with an unhandled error (0 pass / 0 fail / 1 error)** instead of a graceful, handler-named assertion failure — see Bugs Found. Deleted the fixture file and its directory immediately after observing the result; `git status` in the backend repo confirmed clean before AND after. FAILED (see Bugs Found — non-blocking).

**Manual smoke — TC-14/TC-15 (PASSED).** `.playwright/cli.config.json` `outputDir` set to this story's `evidence/` before any browser action. Navigated to staging (already had a persisted STAGING_USER session via the non-isolated Playwright profile) → Settings → Tokens. Issued a new PAT (`bk497-manual-smoke-tc14`, scope `atc:read`) via the "New token" modal — screenshot of the filled form, screenshot of the "Token created" dialog showing the raw secret once, screenshot of the token now listed. Clicked Revoke → confirmation dialog → confirmed → screenshot of the row showing `revoked`. Then, via curl (not UI), attempted `GET /api/v1/tokens` with the now-revoked raw secret → **401 `"Invalid token."`** — rejected as expected. Raw secret was captured only into a scratchpad file outside the repo for the single verification curl call, then shredded immediately after use; never printed in this file or any committed artifact.

**Cleanup.** All 5 PATs minted for this pass (TC-01, TC-02, TC-03-preimage, TC-04, TC-13's throwaway) revoked via cookie-authenticated `DELETE /api/v1/tokens/{id}` — all 204. TC-14/15's token was already self-revoking as part of its own test. TC-02's precondition invite revoked via `DELETE /workspaces/{id}/invites/{inviteId}` — 200. TC-04's workspace-name PATCH used the workspace's own existing name (`"BK-264 QA Sandbox"`), so no drift to revert. Scratchpad cookie jar and raw-secret/token-response files shredded at session end.

### Reporting
Completed 2026-08-19. Compiled the final TC summary from Execution: 17 outlines total (TC-05's sub-case TC-05b folded into TC-05), 15 PASSED, 1 FAILED (TC-08, non-blocking), 1 BLOCKED (TC-03, substitute check PASSED separately). Authored the ATR body per `reporting-templates.md` §2.2 (Result: PASSED WITH ISSUES) and published it to the Story's `customfield_10124` (🧪 Acceptance Test Results) field via the Markdown → ADF (`scripts/md-to-adf.ts`) → REST `PUT /rest/api/3/issue/BK-497` workaround (same mechanism Stage 1 used for the ATP, since `acli workitem edit` rejects custom-field input) — HTTP 204 confirmed on both the initial publish and a follow-up publish that closed a leftover `BK-{PENDING}` placeholder in the SUMMARY paragraph. Materialized via `bun run jira:sync-issues get BK-497 --include-comments` (9 files updated including `acceptance-test-results.md`) and read back to confirm the full body, TC table, Observations and Recommendations landed intact.

Filed the TC-08 finding as **BK-542** (Improvement, per the user-confirmed classification — test-suite robustness/DX gap, not a broken AC). Custom-field textarea fields (`Actual Result`, `Expected Result`, `Evidence`) required ADF payloads too, not bare strings as the acli docs' three-shapes table implies — this Jira instance's textarea fields reject plain strings with "field value is not valid Atlassian Document Format (ADF) content." (confirmed empirically: the first `create --from-json` attempt with bare strings for those 3 fields failed with exactly 3 ADF errors; converting each to ADF via `md-to-adf.ts` and retrying succeeded). Set `components: [Tenancy & Identity]` (closest pre-existing product-area match to the PAT/API-auth capability posture domain — no dedicated "PAT/Auth" component exists in the project's Components module), `priority: Low` (auto-derived from Severity Minor per the severity→priority matrix), and `parent: BK-183` (QA Defect Management epic, pre-cached in `.agents/project.yaml` `qa.qa_epics.defect_epic.key` — confirmed still resolves) via a single REST `PUT` after creation (native `components`/`priority`/`parent` are not exposed by `acli create`'s documented JSON template). Jira auto-defaulted the native `assignee` to the creator (self) on create with no explicit assignee passed — cleared it via `acli jira workitem assign --remove-assignee` to keep the native dev-assignee lane free per defect-management-doctrine.md Part 2 (QA Assignee, `customfield_10070`, is the separate QA-owner field and was set to self via `additionalAttributes` at creation, not touched by the removal). Created the traceability link `acli jira workitem link create --out BK-542 --in BK-497 --type "Problem/Incident"` and verified direction via `link list --key BK-497 --json` — confirmed `outwardIssueKey: "BK-542"` on BK-497 (BK-497 is the outward "causes" party, BK-542 is inward "is caused by"), correct per the doctrine's Story-causes-Improvement pattern and acli's empirical `--out`/`--in` inversion.

Posted the QA comment on BK-497 (Template A adapted for PASSED WITH ISSUES — verified behaviors, one explicitly-flagged non-fully-verified item (AC-06/TC-03), one non-blocking finding with a real clickable link to BK-542) via `acli jira workitem comment create -F` (ADF, comment id 12490). Transitioned BK-497 `In Test` → `QA Approved` via `acli jira workitem transition --key BK-497 --status "QA Approved"` (the `qa_sign_off` transition, id 10) — confirmed by the CLI's success message. No `defect_reported`/`blocked` gate fired — TC-08 was user-confirmed as an Improvement (not a defect) before filing, so this Story took the GO-with-debt / PASSED path per §5.0-§5.1 of `reporting-templates.md`, not the blocking path.

**Transition Trail:** BK-497 `In Test` (10041) → `QA Approved` (10020), transition `QA Sign-Off` (id 10), executed 2026-08-19 via acli.

## Bugs Found
1. **Filed as [BK-542](https://upexgalaxy71.atlassian.net/browse/BK-542) (Improvement) — `route-capability-coverage.test.ts` crashes with an unhandled error instead of a graceful per-handler assertion failure, when a route file passes `withApiHandler(handler)` with the options argument fully omitted (TC-08).** `lib/api/route-posture-scan.ts:146` (`postureAt`) `throw`s when its regex finds no `auth:` match, with a comment asserting this path is "only reachable if the union were widened or bypassed with a cast" — but `bun test` does not type-check (no `tsc` gate runs inside the test runner itself), so a file that bypasses `types:check` (e.g. slips past a pre-commit hook skip, or is scanned before `types:check` runs in a differently-ordered CI) reaches this throw for real. The crash takes down all 6 `it()` blocks in the file (0 pass / 0 fail / 1 error) instead of the single, named, actionable failure the test's own design implies (`it('leaves no handler without a posture', ...)` — which assumes a gracefully-returned "undeclared" row, never observed in practice). In the CURRENT repo this is fully defended in depth by `types:check` running before `bun test` in the Husky pre-commit chain, so it is **not a live production risk** — logged as a test-suite robustness / DX gap for Stage 3 to file as a non-blocking **Improvement**, not a Bug or Defect. Severity: Minor. Non-blocking — did not stop the pass. Evidence: terminal output captured in-session (not saved as a file — text-only finding, no visual/positional component per exploration-patterns.md's annotate-only-if-visual rule).

## Observations
- This is a Story, not a Bug — bug-specific fields/workflow skipped per briefing.
- inbox_check_required = false — not email/magic-link dependent.
- Dev's own evidence table (1555 pass / 1 fail, types clean, lint 0 errors) and the `cookie-only-posture.test.ts` behavioural proof are strong inputs for Stage 1 Test Analysis — likely to shape it toward a non-regression-weighted ATP (per Ely's framing) plus one explicit behavioural-change verification lane (token issue/revoke) rather than a broad new-feature test design.
- The AC-coverage gap on the headline "fails to compile without a posture" property (see context.md § Open Questions #1) is a genuine test-design doctrine question (AC = floor, not ceiling) to resolve explicitly in Stage 1 rather than silently pass over.
- **RESOLVED 2026-08-19 by QA owner** — TC-05-09 execution mechanism: **Option A**, scratch `tsc --noEmit` fixture, NOT committed to `app/api`. Stage 2 verifies the property holds today only. Stage 3 files a non-blocking **Improvement** recommending dev add a committed type-only test (`tsd`/`expectTypeOf`) so the property is regression-protected going forward — the team deliberately chose not to invent a Jira AC for it during delivery (Ely's comment), so this stays a suggestion, not a defect.
- **NEW 2026-08-19 — TC-03/AC-06 live-reproduction limitation.** See Execution narrative above for the full chain (issuance guard, read-only DB role, sole-owner membership block, no role-update API). Recommend Stage 3 note this as a QA-process observation (not a bug): if AC-06-style regression coverage is ever needed live again, the team would need either a scoped DB-write QA role for exactly this kind of legacy-state simulation, or a dedicated non-owner "admin" seed account with 2+ workspace memberships pre-provisioned in `.env`. Not filed as a Defect/Improvement against the product — it is a test-environment/tooling gap, and the underlying product behaviour is already covered by the dev's own automated `workspace-context` suite.
- **NEW 2026-08-19 — api-login tooling drift.** The api-testing-doctrine.md / exploration-patterns.md documented flow (`bun run api:login <env> --role <role>` → `.auth/tokens.env` with `API_TOKEN_<ROLE>_<ENV>` vars) does not match this repo's current `scripts/api-login.ts`, which writes a single `API_TOKEN` to `.env` plus `.auth/api-state.json`, with no `--role` flag and no multi-role token file. A STALE `.auth/tokens.env` (last modified 2026-08-14, 5 days old, apparently from a prior BK-264 session) happened to still be present and its tokens still valid (Bunkai PATs default to no expiry — confirmed via `lib/api/pat.ts`/`signin/route.ts`, `expiresInDays ?? null`), which is what made the multi-role OWNER/ADMIN/MEMBER/VIEWER/INACTIVE tokens usable this session despite the doctrine mismatch. Worth a doc-sync follow-up outside BK-497's scope (not filed here) — this is boilerplate/skill drift, not a Bunkai product issue.
- TC-04's PATCH used the workspace's existing name as the payload (no-op-equivalent write), so smoke coverage was genuine (write path exercised, RLS/role gate exercised) without leaving any actual name drift to clean up.

## Checklist

### Session Start
- [x] Ticket + comments fetched (already synced prior to this session; read here, not re-fetched)
- [x] Project context loaded (master-test-plan.md, business-data-map.md, business-feature-map.md, business-api-map.md, project.yaml)
- [ ] Module context loaded or created — `EPIC-BK-1-tenancy-identity/module-context.md` not checked yet; deferred to Stage 1 per skill's Step 4 (module context is epic-level and reusable — out of this read-only Session Start briefing's explicit scope)
- [x] Code explored (backend) — via implementation-plan.md's Code Locations (dev-authored, file:line level); no independent repo exploration performed this session (read-only session-start, PBI files already carry the exact locations)
- [ ] Code explored (frontend) — not yet; `IssueTokenModal.tsx` identified as relevant from implementation-plan.md but not independently opened this session
- [ ] Test data candidates identified — candidates listed in § Test Data above from ticket ACs, but not yet confirmed against live DB (deferred to Stage 1/2)
- [x] PBI folder + context.md + test-session-memory.md created
- [x] Story Explanation written
- [ ] Playwright config set (if UI test) — N/A this session; BK-497 is API/backend-level, no UI test surface identified in scope

### Planning (Feature)
- [x] Triage completed (veto n/a — Story; risk score 7/MEDIUM-HIGH computed)
- [ ] Test data discovered via DB — feasibility checked (Phase 0.3), actual minting deferred to Stage 2 execution
- [x] ATP created and written to Story field (jira-native — no separate ATP/ATR issues; ATR field initialized empty, filled Stage 3)
- [x] Test Analysis filled in ATP (Phases 3-5: refined scenarios, technique-driven outlines, coverage estimate, parametrization, edge cases, test-data summary)
- [x] AC Gaps written (1 gap: headline compile-time property has no formal Jira AC — addressed via Scenario D per Decision #1, not a blocker)
- [ ] TCs created with full traceability — n/a this stage (jira-native defers to Stage 4)
- [x] Traceability verified — `customfield_10067` populated on BK-497, confirmed via REST PUT 204 + synced cache read-back
- [x] ATP marked complete
- [x] acceptance-test-plan.md materialized via bun run jira:sync-issues in PBI

### Execution
- [x] Ticket transitioned to in-test (`Ready For QA` → `In Test`, transition id 9)
- [x] Smoke test passed (Go/No-Go) — TC-04/TC-12/TC-13 all PASSED
- [x] All TCs executed; none NOT RUN — 16 PASSED, 1 FAILED (TC-08), TC-03 BLOCKED with documented reason + substitute check run (per the "no NOT RUN" rule's decision-path requirement)
- [ ] TCs marked PASSED or FAILED in [TMS_TOOL] — deferred to Stage 3 (ATR write-back)
- [x] Edge cases explored beyond TCs — TC-16 (auth-order), TC-17 (posture spot-check) both Error Guessing charters run
- [x] DB cross-validation performed (if applicable) — TC-01, TC-02, TC-10, TC-11, TC-14/15 all DB-confirmed via `staging-dbhub`
- [x] Evidence screenshots saved — 5 PNGs in `evidence/` (TC-14 form, TC-14 created-dialog, TC-14 listed, TC-15 confirm-dialog, TC-15 revoked-state)
- [x] Bugs documented (if found) — 1 non-blocking finding (TC-08 coverage-check crash) logged above

### Reporting
- [x] ATR report filled and marked complete — `customfield_10124`, Result PASSED WITH ISSUES (15/17)
- [x] acceptance-test-results.md materialized via bun run jira:sync-issues in PBI
- [x] QA comment posted — comment id 12490, Template A adapted for PASSED WITH ISSUES
- [x] Ticket transitioned to the work-type terminal QA state via substrate — `In Test` → `QA Approved` (transition id 10, `QA Sign-Off`)
- [x] Improvement filed for TC-08 non-blocking finding — BK-542, parented BK-183, linked to BK-497 (Problem/Incident, direction-verified)
