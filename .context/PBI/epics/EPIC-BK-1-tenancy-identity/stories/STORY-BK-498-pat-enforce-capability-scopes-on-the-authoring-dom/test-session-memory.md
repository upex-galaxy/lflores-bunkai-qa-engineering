# Test Session Memory: BK-498

> Shared memory across sub-agents. Each stage updates its section.
> Last updated: 2026-08-20 by Session Start

## Ticket
- ID: BK-498
- Title: PAT | Enforce capability scopes on the authoring domain
- Type: Story
- Priority: Medium
- Story Points: 8
- Dev: Luis Eduardo Flores Villarroel (implementing dev per PR #186; also QA assignee)
- Reporter: Ely
- Project: Bunkai (BK)
- Platform: Backend / API (Next.js route handlers, `app/api/v1/*`)
- Sprint: n/a (not sprint-tagged in synced story.md)
- Status: In Test
- Labels: shift-left-2026-08-14, shift-left-reviewed
- Epic: BK-1 (Tenancy & Identity)
- Provenance: split (one of three ratified slices) from BK-262 (ABORTED, split not abandoned) per 2026-08-17 AI Product Owner / AI Tech Lead ruling; depends on BK-497 (QA Approved 2026-08-19, Foundation slice); sibling BK-499 (read/identity/notification/workspace routes) still `Backlog`, must merge after BK-498.

## Modality
jira-native (`.agents/project.yaml` → `testing.tms_cli: acli`). No Xray. `/acli` loaded for future Jira writes (comment/transition/link). Detailed reads via `bun run jira:sync-issues get BK-498 --include-comments`, never `acli workitem view` for custom fields.

## Story Explanation
BK-498 is the second of two successor Stories that turn on real capability enforcement for Bunkai's Personal Access Tokens (PATs), building on BK-497's foundation (which only made every route *declare* a posture, without changing any behavior). This Story flips the switch for the "authoring domain" — the 22 API handlers that create, read, update, and delete Modules, User Stories, Acceptance Criteria, Environments, Milestones, and Import jobs.

Before this change, a PAT minted for read-only work (or one that leaked) could still create, rename, or delete authoring content — nothing stopped it. After this change, every one of those 22 handlers checks the token's capability *before* touching the database: reads need `atc:read`, writes (create/update/delete) need `atc:write`. A correctly-scoped token still works exactly as before; an under-scoped token now gets rejected with `403` and nothing is changed. A browser session (a human logged into the UI) is never affected — sessions always carry the full capability set, only PATs can be narrowed.

Code exploration this session confirms the implementation is already live on `staging`: all 22 handlers declare the correct posture, and the capability check (`requireCapability`) runs inside the shared `withApiHandler` gateway *before* the handler body executes — so a rejected request never reaches the database, exactly as the Definition of Done requires. There's one deliberate nuance worth knowing: the two Import endpoints split across scopes (`POST /imports` needs `atc:write`, `GET /imports/{id}` needs `atc:read`), so a client automating imports end-to-end needs a token with *both* scopes — this was reviewed and intentionally kept by the AI Product Owner, not a defect.

What we'll test: the four Jira-formal acceptance scenarios (properly-scoped write succeeds; read-only token rejected on write with a 403 and *no side effect*; an unbound write-scoped token still succeeds for a real member; a read-scoped token succeeds reading a non-ATC resource) plus a broader sweep across the 22 handlers and the import dual-scope nuance, using freshly-minted narrow-scoped test PATs against real staging data.

## Acceptance Criteria
1. **AC-01** — A properly-scoped token succeeds creating a module: PAT scoped exactly `atc:write` → `POST` new module → `201`.
2. **AC-03** — A token scoped only for reads is rejected creating a module: PAT scoped exactly `atc:read` → `POST` new module → `403`, no module created.
3. **AC-07** — A token with no workspace binding succeeds on a non-admin action when its user is a real member: PAT scoped `atc:write`, unbound, underlying user is an active workspace member → `POST` new module → `201`.
4. **AC-08a** — A properly read-scoped token succeeds reading a non-ATC resource: PAT scoped `atc:read` → `GET /modules/{id}/user-stories` → `200`.

> Numbering carried verbatim from BK-262 (AC-01/AC-03/AC-07); AC-08a is a partition of BK-262's AC-08 pointed specifically at the authoring domain's non-ATC read.

## Team Discussion
(Full detail in `context.md` § Team Discussion — source `comments.md`. Summary:)
- **PR lifecycle (bot comments):** PR created → merged + deployed to staging. Dev task Done.
- **AI Product Owner ruling (2026-08-19, mid-review):** Import workflow (`POST /imports` = `atc:write`, `GET /imports/{id}` = `atc:read`) deliberately keeps the ratified verb mapping unchanged even though it means a write-only token can't poll its own import job. Not a defect — `DEFAULT_PAT_SCOPES` already grants both scopes by default; only a deliberately-narrowed write-only token is affected, and that's discoverable via the OpenAPI spec.
- **Ely, QA handoff (2026-08-19):** Assigns Luis as QA owner. PR #186 merged to `staging`, merge commit `0becadc`. No migration. What-to-test table matches the 4 formal ACs plus the browser-session-unaffected control. Known limitation disclosed: `capability-enforcement.test.ts` is credential-gated in CI (ran live this cycle, passed).

## Environment
- Web: https://staging-upexbunkai.vercel.app | API: https://staging-upexbunkai.vercel.app/api/v1
- WEB_URL_OVERRIDE: none
- API_URL_OVERRIDE: none
- DB MCP: staging-dbhub | API MCP: staging-openapi
- active_env: staging (project.yaml testing.default_env; reachability already confirmed by orchestrator preflight)

## Test Data
Candidates identified via `staging-dbhub` this session. Nothing minted or written yet (Session Start is read-only).

**PAT scoping constraint (same as BK-497):** `POST /api/v1/tokens` is `auth: 'cookie-only'` — a PAT cannot mint another PAT. Narrow single-scope test tokens (exactly `atc:write`, exactly `atc:read`) must be minted live in Stage 2 via a cookie session (`POST /api/v1/auth/signin` with a curl cookie jar, proven working by BK-497), then `POST /api/v1/tokens` with an explicit `scopes` array. The existing `.auth/tokens.env` role tokens (OWNER/USER/MEMBER/VIEWER/ADMIN/INACTIVE) are all `DEFAULT_PAT_SCOPES` (`atc:read`+`atc:write`+`run:execute`) — none is narrow enough to exercise this Story's gate.

- AC-01 (PAT scoped exactly `atc:write`): **Generate** live via cookie session.
- AC-03 (PAT scoped exactly `atc:read`): **Generate** live — 5 un-revoked `atc:read`-only tokens already exist in workspace `6646f244-a28c-441e-8486-9af33bdb5c11` (`BK-264 QA Sandbox`) dated 2026-08-20 (today), but only the SHA-256 hash is stored (never the raw secret, per `access_tokens` schema) — cannot reuse, must mint fresh. **Observation**: these leftover un-revoked narrow tokens (and several `workspace:admin`-scoped ones, and two `atc:write`+`run:execute` ones — none scoped exactly `atc:write` alone) suggest a prior session in this workspace did not fully clean up; worth a Stage 3 cleanup pass regardless of source.
- AC-07 (PAT scoped `atc:write`, unbound, real member): **Generate** live. Unlike BK-497's AC-06 (`workspace:admin` unbound — blocked by `assertTokenIssuanceAuthorized`'s admin-issuance guard), `atc:write` unbound issuance is NOT guarded by that check (confirmed by reading `lib/api/pat.ts` this session) — expected to mint cleanly, no BK-497-style substitute-check workaround anticipated.
- AC-08a (PAT scoped `atc:read`) + mirror (PAT scoped `atc:write`-only on the same GET): **Generate** live, same mint flow.
- Import dual-scope nuance (non-AC, from Team Discussion): a token needs both `atc:read`+`atc:write` to drive an import end-to-end — worth one explicit outline distinguishing "expected 403" from "regression."

**Stage 2 PAT-minting plan (from the published ATP's Phase 5 Data Generation Strategy):** 4 narrow-scope PATs must be minted live before execution, reusing BK-497's proven flow (`POST /api/v1/auth/signin` → cookie jar → `POST /api/v1/tokens` with an explicit `scopes` array):
  1. `atc:write`-only, bound to `BK-264 QA Sandbox` (workspace `6646f244-a28c-441e-8486-9af33bdb5c11`) → feeds R1/R2(inverse)/R6(control baseline)/TC12.
  2. `atc:read`-only, same workspace binding → feeds R2/R4/R5/TC11/TC13.
  3. `atc:write`-only, **unbound** (`workspace_id` omitted) → feeds R3 (AC-07) — expected to mint cleanly per code read (`assertTokenIssuanceAuthorized` only guards `workspace:admin`, not `atc:write`/`atc:read`), but not yet proven live; confirm early in Stage 2, BK-497's substitute-check pattern is the fallback if it turns out blocked after all.
  4. `atc:write`, then **revoked** immediately after minting (via `PATCH`/`DELETE` on the token) → feeds R10.
  - R6 (unauthenticated) needs no minted token — just omit the `Authorization` header.
  - R7 (membership-403) needs a correctly-scoped `atc:write` PAT whose underlying user is NOT a member of the target workspace — candidate: reuse one of the BK-337 foreign/admin/viewer fixture projects/workspaces already identified in Test Data below instead of minting a new token.
  - R8/TC15 (default-scope controls) reuse existing `.auth/tokens.env` role tokens — no new minting needed.
  - R9 (browser-session control) reuses the same `POST /api/v1/auth/signin` cookie jar directly, no PAT step.
  - **Cleanup discipline carried into Stage 2**: revoke all 4 newly-minted PATs at the end of execution; also do a cleanup pass on the leftover un-revoked narrow-scoped PATs already observed in `BK-264 QA Sandbox` (unrelated to this run, flagged in Session Start) since they add noise to the workspace's token list.
- Candidate authoring entities (staging DB, `staging-dbhub`, read this session):

  | Project | Workspace | Module | Notes |
  |---|---|---|---|
  | `BK264 Defect Triage` (`2fee236f-1246-40c4-bfc4-d332287f9548`) | `6646f244-a28c-441e-8486-9af33bdb5c11` (`BK-264 QA Sandbox`) | `Defect Triage Module` (`175f8a08-20b9-4c96-a21a-e02dcae2837e`) | Same workspace BK-497 proved out — STAGING_USER is sole owner, session-mint flow already validated here. **Preferred reuse target.** |
  | `BK-398 QA Search Fixture` (`f134d6f7-819a-4975-8dbb-872b948c3e51`) | `1675c5e1-c9a4-46a2-beb2-9beb3d97d663` | `BK-398 QA Module` (`86c67531-aa13-4394-bd1f-a477d669ceb8`) | Alternate fixture, membership not yet confirmed |
  | `BK-337 Foreign/Admin/Viewer Project (QA fixture)` (x3, workspaces `...31`/`...41`/`...51`) | separate per-project | `Fixture Module` (x3) | Purpose-built BK-337 cross-workspace fixtures — good for AC-07's "no workspace binding" edge if the `BK-264 QA Sandbox` membership setup proves insufficient |

- `access_tokens` table: 10 columns, 2467 total rows repo-wide, only `token_prefix` + SHA-256 hash persisted (no raw secrets recoverable from DB, ever).
- Cleanup: revoke every PAT minted for this ATP's execution at the end of Stage 2 (same discipline as BK-497).

## Repositories
- Backend: /home/lflores/proyectos/cursos/dojo3/upex-bunkai-tms (Next.js + Supabase + Vercel, entry `.`)
- Frontend: /home/lflores/proyectos/cursos/dojo3/upex-bunkai-tms (Next.js, entry `.`) — same repo, monolith

## Code Locations
### Backend (upex-bunkai-tms) — confirmed by direct code read this session (`git log -1`: `323b01c`, `staging` HEAD)
- `lib/api/handler.ts:74-101` (`withApiHandler`) — capability gate (`requireCapability` loop over `options.requires`) runs before `handler(request, ctx)`. Confirms the DoD's "rejected before any change happens."
- `lib/api/principal.ts:84-88` (`requireCapability`) — throws `forbidden` on a missing capability.
- `lib/api/pat.ts` — `DEFAULT_PAT_SCOPES` (atc:read+atc:write+run:execute); admin-issuance guard (`assertTokenIssuanceAuthorized`) only fires for `workspace:admin`, not `atc:write`/`atc:read`.
- `app/api/v1/tokens/route.ts:108` — token issuance is `cookie-only`; PATs cannot mint PATs.
- `app/qa/qa-config.ts:625-626` — published scope-vocabulary QA contract (`atc:read`/`atc:write` DEFAULT purposes).
- 11 route files / 22 handlers, all confirmed with correct posture this session — see `context.md` § Related Code for the full file:line → posture table.
- `lib/api/capability-enforcement.test.ts`, `lib/api/route-capability-coverage.test.ts` + `.snapshot.json` — dev evidence, not independently re-run this session (credential-gated DB-integration suite).

### Database (Supabase Postgres)
- `access_tokens` (10 cols, 2467 rows) — see Test Data.
- `modules` (9 cols: id, project_id, parent_module_id, path, name, position, created_at, description, archived_at) — confirmed schema this session.
- `supabase/migrations/0008*access*tokens.sql:34-36` — scope CHECK constraint, untouched (no migration).

## TMS Artifacts
| Type | ID | Name | Status |
|------|----|------|--------|
| ATP  | Story field `customfield_10067` (Acceptance Test Plan — synced) | ATP: BK-498: PAT | Enforce capability scopes on the authoring domain | **Written + synced 2026-08-20** — 15 outlines (10 Decision-Table rows on Modules anchor + 4 parametrized cross-family sweep artifacts + 1 Import positive control); `acceptance-test-plan.md` materialized and read back to confirm |
| ATR  | Story field `customfield_10124` (`acceptance_test_results`) | — | Not yet written; Stage 3 |
| TC   | -  | -    | n/a — jira-native defers TC creation to Stage 4 |

## Paths
- PBI: .context/PBI/epics/EPIC-BK-1-tenancy-identity/stories/STORY-BK-498-pat-enforce-capability-scopes-on-the-authoring-dom/
- Module Context: .context/PBI/epics/EPIC-BK-1-tenancy-identity/module-context.md (still does not exist — same gap BK-497 left open; Stage 1 to decide)
- Session plan: .session/sprint-testing/BK-498/plan.md

## Stage Results
### Session Start
Completed 2026-08-20. Synced BK-498 fresh via `bun run jira:sync-issues get BK-498 --include-comments` (7 files created: story.md, acceptance-criteria.md, business-rules.md, scope.md, out-of-scope.md, implementation-plan.md, comments.md). Loaded project-wide context — all 4 files present (business-api-map.md, business-data-map.md, business-feature-map.md, master-test-plan.md), no missing_input.

Explored the target repo directly (not just dev-authored implementation-plan.md, unlike BK-497's read-only session-start): located and grep-read all 11 route files covering the 22 authoring-domain handlers, confirmed every one already declares the DoD-correct posture (7 GET → `atc:read`, 15 POST/PATCH/DELETE → `atc:write`), and read `lib/api/handler.ts` + `lib/api/principal.ts` directly to confirm the capability gate runs before the handler body — the DoD's "403 before any change" clause is structurally satisfied, not just claimed by the dev.

Queried `staging-dbhub` for PAT infrastructure (`access_tokens` table, 2467 rows, hash-only — no raw secret recoverable) and candidate authoring entities (5 candidate project/module pairs found, `BK264 Defect Triage` in `BK-264 QA Sandbox` workspace preferred as BK-497 already proved the session-mint flow there). Discovered — but did not use — several un-revoked narrow-scoped PATs from 2026-08-20 in that same workspace; none scoped exactly `atc:write` alone, none reusable regardless since only hashes are stored; flagged as a possible cleanup gap for Stage 3.

Created hand-authored `context.md` (Team Discussion, Open Questions, Related Code file:line table) and this `test-session-memory.md`. Did not touch any Jira-mirrored file. No Jira writes performed (read-only session-start). No `.session/sprint-testing/BK-498/progress.md` existed prior to this session (Phase 0 resume check: fresh start, no prior state) — `plan.md` written per `session-management.md` §6; `progress.md` entries are appended by the orchestrator, not by this dispatch.

### Stage 1 Planning
Completed 2026-08-20. Loaded `agentic-qa-core/references/test-design-doctrine.md` and `sprint-testing/references/acceptance-test-planning.md` first. Checked the §0.0 Shift-Left short-circuit: labels `shift-left-2026-08-14`/`shift-left-reviewed` are present, but `shift-left-refinement.md` does not exist on disk for this Story (nor for BK-497) — validation failed, so fell through to the standard Phase 0-4 flow (no short-circuit; Phases 1-3 run in full).

Derived 15 test outlines/artifacts from the 4 formal ACs (AC-01/03/07/08a) via technique-driven derivation:
- **Decision Table (10 rules, R1-R10)** on the Modules family as the AC-anchor — conditions: Operation (read/write) × PAT-scope-shape × workspace-membership. R1-R4 map directly to AC-01/03/07/08a; R5-R10 are risk-beyond-AC (read-mirror of AC-03, unauthenticated-401 vs capability-403, membership-403 vs capability-403, default-scope regression control, browser-session non-regression control, revoked-token 401).
- **4 parametrized cross-family EP-sweep artifacts (TC11-TC14)** — one representative write/read endpoint per remaining resource family (User Stories, Acceptance Criteria, Environments, Milestones, Imports), collapsing ~20 endpoint-level wiring checks into 4 artifacts per the Part 2.5 artifact-economy rule, since the capability gate is the same function for all 22 handlers (confirmed by direct code read in Session Start) — family does not interact with scope/operation, so full pairwise across family×scope×membership was explicitly declined and logged (would have re-tested identical gate logic 6× with no new partition explored).
- **1 Import dual-scope positive control (TC15)** — the AI Product Owner-ratified "expected 403" nuance is called out explicitly against the TC11/TC14 Import rows so Stage 2/3 does not misclassify it as a regression.

BVA and State-Transition were both scored **N/A with written justification** (no ranges/lengths/counts/date-windows in the AC set; no Story-owned lifecycle field — the one lifecycle-adjacent case, revoked token, is handled as an Error-Guessing risk case, not a formal transition table). Ran the full Test-Design Checklist — **PASS**, all 12 items YES or justified N/A.

Authored the ATP as Markdown (Phases 1-5 structure per `acceptance-test-planning.md`), converted to ADF via `bun .claude/skills/acli/scripts/md-to-adf.ts` (validated clean, no combined-marks or containment errors), and published to the Story's `acceptance_test_plan` field (`customfield_10067`, resolved by slug — confirmed present in `.agents/jira-fields.json`, no fallback comment needed) via the REST `PUT /rest/api/3/issue/BK-498` workaround (HTTP 204) — `acli workitem edit` does not accept custom-field input on existing items, per the `acli` skill's documented gotcha. Ran `bun run jira:sync-issues get BK-498 --include-comments` to materialize `acceptance-test-plan.md` and read it back — content confirmed intact (Phase 1-5 sections, Decision Table, parametrized sweep tables, checklist all present; only cosmetic bold-marker rendering artifacts from the ADF→Markdown round-trip, no content loss).

No Test work items created (jira-native modality — TC creation deferred to Stage 4 `test-documentation`, regression-worthy outlines only). No ticket transition performed; Stage 2 not dispatched — scope ends at ATP publication + verification per this dispatch's instructions.

### Stage 2 Execution
Completed 2026-08-20. Loaded `agentic-qa-core/references/api-testing-doctrine.md` (three-tool maneuver) before executing. Smoke test **GO**: `GET /health` → 200, `GET /workspaces` (existing `API_TOKEN_OWNER_STAGING`) → 200 with 3 workspaces including `BK-264 QA Sandbox`.

**PAT-minting procedure used (documented for reuse):**
1. `POST /api/v1/auth/signin` with `STAGING_USER_EMAIL`/`STAGING_USER_PASSWORD` (from `.env`) + a curl cookie jar (`-c cookies.txt`) → `200`, session cookie set. Side effect confirmed: this endpoint *always* mints a default-scope (`atc:read`+`atc:write`+`run:execute`) PAT named `cli-signin` in the same call (its own `pat_scopes` field only controls that PAT's scopes, has no `workspace_id` field — always unbound). Not used as a test fixture; revoked at cleanup.
2. Four `POST /api/v1/tokens` calls, cookie-authenticated (`-b cookies.txt`), each with an explicit `scopes` array (+ `workspace_id` where bound):
   - `atc:write`-only, bound to `BK-264 QA Sandbox` (`6646f244-a28c-441e-8486-9af33bdb5c11`) → id `c62ff417-99ca-4316-b168-5641e4d203a8`
   - `atc:read`-only, same workspace → id `4cf15a72-89c8-4ff6-9086-adb27d784ab1`
   - `atc:write`-only, **unbound** (`workspace_id` omitted) → id `fa032a6c-d40e-44ed-819b-9485b5f5264c` — minted cleanly on first try, confirming the Open Question #3 prediction (`assertTokenIssuanceAuthorized` only guards `workspace:admin`, not `atc:write`).
   - `atc:write`-only, bound → id `72bed446-9bc8-49e8-9faa-d942f324a1d6`, then immediately `DELETE /api/v1/tokens/{id}` (cookie-authenticated) → `204`, producing the revoked-token fixture for R10.
3. All 4 raw secrets captured once into a gitignored scratchpad file (never written to the repo or logged in evidence), sourced fresh per curl call per the doctrine's per-call `source` requirement.

**15/15 TC outlines executed live against staging — 15 PASS, 0 FAIL, 0 not-executed.**

| Outline | Result | Evidence | Notes |
|---|---|---|---|
| R1 (AC-01) | PASS | `evidence/R1.txt` | `201`, module row confirmed in DB (`fbf80334-...`) |
| R2 (AC-03) | PASS | `evidence/R2.txt` | `403 forbidden` ("Missing required capability: atc:write"), DB confirms 0 rows named `QA BK498 R2 *` |
| R3 (AC-07) | PASS | `evidence/R3.txt` | `201` — unbound `atc:write` PAT succeeded for a real member, exactly as predicted |
| R4 (AC-08a) | PASS | `evidence/R4.txt` | `200` + `{"user_stories":[]}` |
| R5 | PASS | `evidence/R5.txt` | `403` ("Missing required capability: atc:read") — read-mirror of AC-03 confirmed |
| R6 | PASS | `evidence/R6.txt` | `401 unauthorized` ("Authentication required."), no `Authorization` header — distinct from R2/R5's `403` |
| R7 | PASS | `evidence/R7.txt` | `403` but message `"You must be a member of this project to create a module."` / `details.reason: "not_a_member"` — **distinct failure surface from R2's capability-403**, confirmed not conflated. DB confirms 0 rows named `QA BK498 R7 *` despite the token itself being correctly `atc:write`-scoped |
| R8 | PASS | `evidence/R8.txt` | Default-scope `.auth/tokens.env` OWNER token: `201` on write + `200` on read, no regression |
| R9 | PASS | `evidence/R9.txt` | Browser session cookie (no PAT) → `201` — sessions unaffected by PAT scoping, confirmed |
| R10 | PASS | `evidence/R10.txt` | Revoked `atc:write` token → `401 unauthorized` ("Invalid token.") — distinct from R2/R5's valid-but-under-scoped `403`, as designed |
| TC11 | PASS | `evidence/TC11.txt` | All 5 families (User Stories, Acceptance Criteria, Environments, Milestones, Imports) → `403` on `atc:read`-only. DB confirms 0 side-effect rows for all 5 (Imports: only the 2 *expected* successful imports from TC12+TC15 exist, none from this rejected attempt) |
| TC12 | PASS | `evidence/TC12.txt` | All 5 families → `2xx` on `atc:write`-only, side effects created (used as TC13's read fixtures). One self-inflicted `422` on the first Milestones attempt (sent `description: null`; schema wants a string or omitted) — a body-validation mistake on my part, not a capability-gate defect; retried with `description` omitted → `201` |
| TC13 | PASS | `evidence/TC13.txt` | All 5 families → `200` on `atc:read`-only, using TC12's created IDs |
| TC14 | PASS | `evidence/TC14.txt` | All 5 families → `403` on `atc:write`-only, including the Imports row (`GET /imports/{id}` rejected for the write-only token) — **matches the AI Product Owner's 2026-08-19 ratified nuance exactly, correctly classified as expected behavior, not a regression** |
| TC15 | PASS | `evidence/TC15.txt` | Full import lifecycle (`POST /imports` → `202` queued, `GET /imports/{id}` → `200` completed) using a dual-scope default PAT — positive control for the TC11/TC14 Import rows confirmed working end-to-end |

**DB cross-validation (DoD's "rejected... before any change happens" clause) — confirmed both directions:**
- **Positive** (R1): `SELECT * FROM modules WHERE id = 'fbf80334-...'` → 1 row, matches the `201` response exactly.
- **Negative** (R2 + R7 + TC11 sweep): zero side-effect rows across `modules` (R2, R7), `user_stories`, `acceptance_criteria`, `project_environments`, `milestones` (TC11), and `import_jobs` shows exactly 2 rows for the shared no-op JQL (`key = "BK-000000"`) matching TC12's + TC15's *successful* creates only — TC11's rejected Imports attempt left zero trace. The capability gate structurally rejects before any DB write, confirmed empirically, not just by code read.

No blocking bugs found. No pause triggered — every outcome matched the ATP's expected result exactly, including the two deliberately-negative-looking-but-ratified cases (R7's membership-403 wording, TC14's Import-family 403).

**Cleanup — all 5 test-minted PATs revoked** (204 each, cookie-authenticated `DELETE /api/v1/tokens/{id}`): the 4 narrow-scope PATs (`c62ff417-...`, `4cf15a72-...`, `fa032a6c-...`, `72bed446-...` — the last was already revoked pre-execution for R10) plus the auto-minted `cli-signin` default PAT (`ed55758b-...`) from the signin call. Zero leftover test PATs from this session. The pre-existing leftover un-revoked narrow-scoped PATs flagged in Session Start (unrelated to this run, hash-only, unusable) remain untouched — still flagged for a Stage 3 cleanup pass, not addressed here since they predate this session and this dispatch's scope was this run's own fixtures only.

Test data created and left in place (not cleaned up — read/write test rows in a QA sandbox project, consistent with BK-497 precedent): 4 `modules` rows (R1, R3, R8, R9), 1 `user_stories` row, 1 `acceptance_criteria` row, 1 `project_environments` row, 1 `milestones` row, 2 `import_jobs` rows (TC12, TC15) — all under `BK264 Defect Triage` / `BK-264 QA Sandbox`, all named with a `QA BK498` / `QA-*` prefix and a unix-timestamp suffix for easy future identification.

## Bugs Found
None this session. Stage 2 Execution ran all 15 outlines live against staging — 15/15 PASS, 0 FAIL. The one anomaly (a `422` on the first Milestones write attempt) was a self-inflicted body-schema mistake (`description: null` vs. omitted), not a capability-gate defect — corrected and retried successfully. No blocking or non-blocking findings beyond what Stage 1 already anticipated (Import dual-scope nuance, membership-vs-capability distinction) — both confirmed exactly as ratified.

## Observations
- This is a Story, not a Bug — bug-specific fields/workflow skipped per briefing.
- inbox_check_required = false — not email/magic-link dependent.
- Unlike BK-497 (which relied on the dev's implementation-plan.md Code Locations without independent repo exploration), this session independently re-derived the full 22-handler posture table directly from the route files — useful cross-check that dev evidence and live code agree exactly (they do).
- The import dual-scope nuance (see Open Questions #1 in context.md) is the one place in this Story where a naive "403 = regression" read would be wrong — Stage 1 test design should call it out explicitly as expected behavior per the AI Product Owner ruling, not silently omit it or misclassify it as a defect if hit during exploration.
- Leftover un-revoked narrow-scoped PATs dated today in the reused `BK-264 QA Sandbox` workspace (see Test Data) suggest either an incomplete cleanup from a prior session/preflight, or the orchestrator's own preflight token checks — worth asking the user or checking session history before assuming it's noise; does not block this session since none are reusable as bearer credentials regardless.

## Checklist

### Session Start
- [x] Ticket + comments fetched (fresh sync this session via `bun run jira:sync-issues get BK-498 --include-comments`)
- [x] Project context loaded (master-test-plan.md, business-data-map.md, business-feature-map.md, business-api-map.md, project.yaml) — no missing_input
- [ ] Module context loaded or created — `EPIC-BK-1-tenancy-identity/module-context.md` still does not exist (same gap left open by BK-497); deferred to Stage 1
- [x] Code explored (backend) — independently re-derived all 22 handlers' postures directly from the 11 route files, plus `handler.ts`/`principal.ts`/`pat.ts` gate-ordering confirmation
- [ ] Code explored (frontend) — not applicable this session; no UI surface identified as in-scope for this Story (PAT scope enforcement is API-only; UI token management itself is BK-497's already-QA-Approved scope)
- [x] Test data candidates identified — DB-confirmed candidate projects/modules; narrow-PAT minting mechanism confirmed feasible (no admin-issuance-guard blocker for `atc:write`/`atc:read`, unlike BK-497's AC-06)
- [x] PBI folder + context.md + test-session-memory.md created
- [x] Story Explanation written (see § Story Explanation above)
- [ ] Playwright config set (if UI test) — N/A this session; BK-498 is API/backend-level, no UI test surface identified in scope

### Stage 1 Planning
- [x] Shift-Left short-circuit checked (§0.0) — labels present but `shift-left-refinement.md` missing on disk → fell through to standard Phase 0-4 flow
- [x] Test-design doctrine loaded and applied (`test-design-doctrine.md`) — 5 principles, technique triggers
- [x] Phases 1-3 (Critical Analysis, Story Quality, Refined ACs) authored
- [x] Phase 4 Test Design — Decision Table (10 rules) + parametrized cross-family EP sweep (4 artifacts) + Import positive control (1) = 15 outlines total
- [x] BVA / State-Transition scored N/A with written justification; Pairwise scored N/A with written justification (replaced by parametrized EP sweep)
- [x] Test-Design Checklist run — PASS (all 12 items YES or justified N/A)
- [x] ATP authored as Markdown, converted to ADF (`md-to-adf.ts`, validated clean), published to `customfield_10067` via REST PUT workaround (HTTP 204)
- [x] Synced cache materialized (`bun run jira:sync-issues get BK-498 --include-comments`) and read back to confirm content intact
- [x] `test-session-memory.md` updated with TC outline summary, Stage 2 PAT-minting plan, design decisions
- [ ] Ticket transition — not performed (out of Stage 1 scope)
- [x] Stage 2 Execution — dispatched and completed 2026-08-20

### Stage 2 Execution
- [x] Smoke test (Go/No-Go) — GO
- [x] 4 narrow-scope PATs minted live via cookie session (write-only bound, read-only bound, write-only unbound, write-then-revoked)
- [x] All 15 ATP outlines (R1-R10 + TC11-TC15) executed live via curl — 15/15 PASS
- [x] DB cross-validation — positive (R1) and negative (R2/R7/TC11) side-effect checks both confirmed
- [x] Evidence saved (`evidence/R1.txt` … `evidence/TC15.txt`, 15 files)
- [x] `test-session-memory.md` updated with PASS/FAIL per outline
- [x] Test PATs cleanup — all 5 (4 narrow-scope + 1 auto-minted `cli-signin`) revoked, zero leftovers from this session
- [ ] Ticket transition / ATR / QA comment — out of Stage 2 scope, deferred to Stage 3
