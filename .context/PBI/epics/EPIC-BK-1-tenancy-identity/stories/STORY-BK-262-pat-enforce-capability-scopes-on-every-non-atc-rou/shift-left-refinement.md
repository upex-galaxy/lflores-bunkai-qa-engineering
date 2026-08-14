# Shift-Left Refinement: BK-262 — PAT | Enforce capability scopes on every non-ATC route

**Status**: Refined — All Critical + Technical Questions Resolved — Ready for Estimation
**Mode**: Shift-Left (pre-sprint, batch of 1)
**Refined on**: 2026-08-14
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context
- **Primary persona affected**: Karim — an autonomous machine caller (AI test agent / CLI / CI pipeline) authenticating with a Bearer PAT (`bk_pat_*`).
- **Secondary personas**: workspace admins/owners and members whose imports, modules, projects, user stories, acceptance criteria, workspace metadata, and invites are the targets of the routes being gated. A leaked or over-broad PAT is a blast-radius risk to all of them.
- **Business value proposition**: containment — a token minted for one narrow job (e.g. "run tests") must not be usable to rewrite project structure or invite members, whether by accident or because the token leaked. This is a security-hardening story, not a feature.
- **KPI(s) influenced**: security posture / attack-surface reduction for the machine-to-machine auth surface (PAT lifecycle — Journey 2 in `business-api-map.md`).
- **User journey position**: sits inside Journey 2 (Machine/CI sign-in + PAT lifecycle) — after a PAT is minted (headless or via `POST /tokens`), on every subsequent `/api/v1/**` call the PAT makes.

### Technical context
- **Frontend**: none. This Story is API-only; the DoD explicitly states browser/session callers are unaffected (Business Rule 2: "A browser session always carries the full capability set — session identity is never scope-restricted").
- **Backend**: Next.js 15 Route Handlers under `app/api/v1/**`, gated by the single gateway `withApiHandler()` (`lib/api/handler.ts`). Identity resolution and capability checking live in `lib/api/principal.ts` (`resolveIdentity()`, `requireCapability()`, `assertWorkspaceContext()`). The scope vocabulary and CHECK constraint live in `lib/api/pat.ts` and `supabase/migrations/0008_access_tokens.sql`.
- **External services**: none.
- **Integration points specific to this Story**: none external. Internally, the fix interacts with Supabase RLS (the second, independent authorization layer per ADR-0001 Path B) — a capability check passing does not bypass RLS, and RLS passing does not bypass the capability check.

### Story complexity
| Axis | Rating | Why |
|------|--------|-----|
| Business logic | Medium | No new business rules — the enforcement *mechanism* already exists and is proven (see Critical Analysis finding below). The work is 48 individual "which capability does this route need" decisions, already answered by a cited design doc (BK-97), not new invention. |
| Integration | Low | Single, centralized mechanism (`requires` option on `withApiHandler`) already used by 25/82 handlers today — this Story extends an existing pattern, it does not introduce a new one. |
| Data validation | Low | Zero DB migration. The 4-scope vocabulary and its CHECK constraint (`access_tokens_scopes_allowed`) are explicitly untouched (confirmed: Out-of-Scope bullet 1, and independently in `0008_access_tokens.sql:34-36`). |
| UI | None | API-only; no frontend surface. |

**Estimated test effort**: High. Not because any single case is hard, but because of surface area — 7 named route families × read/write × 3+ distinct token states (properly-scoped / under-scoped / no-workspace-binding / revoked-expired), against a mechanism where the AS-WRITTEN Story ACs only exercise a subset of that surface (see gaps below).

### Epic-level inheritance
**RESOLVED (2026-08-14)**: BK-262 was reparented from BK-183 ("QA Defect Management", the QA process epic) to **BK-1 "Tenancy & Identity"** — the foundational epic that owns the auth model (sign-up/sign-in, `workspace_members` RBAC, invitations, workspace switching). Root cause identified: BK-262 was created from BK-97, an Improvement, which correctly parents to the QA process epic per this repo's three-axis model — the Story inherited that parent by mistake when it was split out. `parent` + `Epic Link` (customfield_10014) both verified updated in Jira. No `feature-test-plan.md` exists yet at the BK-1 epic level to inherit from.

---

## Central feasibility finding (supersedes an earlier working assumption)

An earlier pass at this Story's feasibility (used to scope this refinement dispatch) concluded that `requireScope()` — defined at `lib/api/middleware/bearer.ts:115` — is called nowhere in the codebase, and that `withApiHandler()` has "zero scope-related logic," implying this Story would need to build first-time enforcement from scratch.

**That conclusion is only half right, and the half that's wrong changes the Story's real shape.** Verified directly against the sibling repo (`upex-bunkai-tms`) today:

- `requireScope()` in `bearer.ts:115` **is** genuinely dead code — confirmed via `grep -rn "requireScope"` across the whole repo, only the definition itself matches. This function is a decoy, not the real mechanism.
- The **real, live enforcement mechanism** is `requireCapability(principal, capability)` in `lib/api/principal.ts:79-83`, invoked from `withApiHandler()` (`lib/api/handler.ts:75-82`) for every string in `options.requires ?? []`, BEFORE the handler body runs. This is not hypothetical — it is **already used by 25 of 82 exported handlers today**, including all 10 ATC-authoring handlers, 4 run-execution handlers, 5 `workspace:admin` handlers (workspace metadata PATCH, invite create/list, invite resend/revoke), and 6 read handlers.
- A second mechanism, `assertWorkspaceContext(principal, targetWorkspaceId)` (`principal.ts:91-104`), is also live and wired into exactly those same 5 `workspace:admin` handlers — it rejects a Bearer caller whose token has no workspace binding (`workspaceId === null`) or whose binding doesn't match the target workspace.

So the Story is **not** "build first-time enforcement, including possibly for ATC routes." It is: **extend an already-proven, centralized mechanism to the 49 handlers that currently omit it** (independently re-measured against the same code today — matches the 8/11 count cited in the Story's Team Discussion exactly: 82 handlers / 64 route files, 25 declaring `requires`, 49 omitting it, 8 `auth: 'public'`). ATC routes are already covered and are correctly out of this Story's blast radius — DoD's "not only ATC routes" phrasing is accurate, not aspirational.

This lowers *mechanism* risk (nothing new to invent, no migration, no new failure mode class) but does **not** lower *size* — 48 individual per-route capability decisions plus a type change touching all 81-82 call sites is still story-shaped, exactly as the cited design decision (BK-97, carried into this Story's comments) concludes. Refinement below treats that decision as already made and does not re-litigate vocabulary or enforcement shape — it stress-tests the **3 published Gherkin ACs** against what the decision doc and the current code actually cover, which is narrower than the ACs' plain-English wording suggests.

**Directly relevant to the 7 named route families** (imports, modules, projects, user stories, acceptance criteria, workspaces, invites) — verified by reading every route file in scope:

| Family / handler | Verb | `requires` today? | In the 49-gap? |
|---|---|---|---|
| `imports` (POST), `imports/[id]` (GET) | write, read | none | Yes |
| `modules/[id]` (PATCH, DELETE) | write | none | Yes |
| `modules/[id]/user-stories` (POST, GET) | write, read | none | Yes |
| `projects/[id]/modules` (POST) — AC1's own example route | write | none | Yes |
| `user-stories/[id]/acceptance-criteria` (POST, GET) | write, read | none | Yes |
| `acceptance-criteria/[id]` (GET, PATCH, DELETE) | read, write, write | none | Yes |
| `workspaces` (POST, GET) | write, read | none | Yes (POST is a deliberate no-capability bootstrap case per BK-97 rationale — see below) |
| `workspaces/[id]` (GET) | read | none | Yes |
| `workspaces/[id]` (PATCH) | write | `workspace:admin` + `assertWorkspaceContext` | **No — already covered** |
| `workspaces/[id]/invites` (POST, GET) — AC2's own example route | write, read | `workspace:admin` + `assertWorkspaceContext` | **No — already covered** |
| `workspaces/[id]/invites/[inviteId]` (POST, DELETE) | write | `workspace:admin` + `assertWorkspaceContext` | **No — already covered** |
| `workspaces/[id]/membership` (DELETE) | write | none (deliberate — a member must be able to leave) | Yes, by design |
| `workspaces/[id]/projects` (POST) | write | none | Yes |
| `invites/accept` (POST) | write | none | Yes — flagged by the cited decision itself as an unresolved ADR-0001 "verify" item, never completed |

Two consequences fall directly out of this table and are carried into Phase 2/3 below:

1. **AC1's example route (`projects/[id]/modules` POST) is a genuine gap-route** — this AC correctly targets unfixed code. Good.
2. **AC2's example route (`workspaces/[id]/invites` POST) already enforces `workspace:admin` today** — an `atc:read`-only token is **already** rejected on invite creation, with zero Story-related development. This AC, as literally written, is a regression-lock on pre-existing behavior, not a test of what this Story ships. Same finding for **AC3's implicit target** — `assertWorkspaceContext()` already runs on that exact route family.

---

## Phase 2 — Story Quality Analysis

### Ambiguities
| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|---|---|---|---|
| 1 | AC1: "a Personal Access Token scoped to manage workspace modules" | No scope literally named "manage workspace modules" exists. Per the cited design decision, the real scope is `atc:write` (the reused-vocabulary decision explicitly maps module-create to `atc:write`, worked example at `projects/[id]/modules/route.ts:34`). Is `atc:write` the confirmed literal precondition? | Cannot write an unambiguous Given-clause without the literal scope value. | Refined AC1 below names `atc:write` explicitly, citing the design decision — no new PO ask needed, already answered upstream. |
| 2 | DoD: "Every non-ATC route family ... checks the caller token's capability scope before making any change" — the phrase "before making any change" | Read-side (GET) requests make no change. Does the DoD's silence on reads mean reads stay open to any authenticated token (no capability required), or is this phrasing just imprecise and reads should also be gated (`atc:read`)? | Determines whether ~6 GET handlers in the 7 named families get a `requires: ['atc:read']` posture or ship as `auth: 'authenticated'` (no capability) — a materially different security posture, currently undecided by both the Story and the cited design doc (see Gap 1 below). | See Critical Question 1. |

### Gaps (missing info)
| # | Type | Why critical | What to add | Risk if omitted |
|---|---|---|---|---|
| 1 | Business rule / technical detail | The cited design decision (BK-97) explicitly slices the 49-handler gap into: Slice 2 "Authoring domain" (~22 write handlers, incl. modules/user-stories/AC/imports), Slice 3 "Reporting reads" (~12 handlers — but those are a **different** set: coverage, bugs heatmap, recovery-cycles, runs report — NOT the GET side of the 7 named families), and Slice 4 "~14 remaining `authenticated` placeholders." The GET handlers for imports/[id], modules/[id]/user-stories, user-stories/[id]/acceptance-criteria, acceptance-criteria/[id], workspaces, workspaces/[id] are not explicitly assigned a slice or a scope anywhere in the cited decision. | Confirm read posture (`atc:read` required, vs. left open) before sprint planning — it changes which of the outlines below are even correct. | Dev picks a posture unilaterally; QA writes a test asserting the wrong expected status for every GET route in scope. |
| 2 | Business rule | `assertWorkspaceContext()` is wired into exactly the 5 `workspace:admin` handlers today. None of the other 44 gap handlers call it — they rely purely on RLS + actual DB membership, ignoring the PAT's `workspace_id` binding entirely. AC3, read literally, implies this check should exist generically on "a non-ATC route that requires workspace context" — but no non-admin route in the gap currently has any concept of "workspace context" distinct from "capability." | Determines whether this Story's blast radius is 49 routes gaining a capability check (as decided), or a **larger** set of routes additionally gaining a workspace-binding check that doesn't exist today outside the 5 admin routes. | If unresolved, QA cannot write a correct AC3 test for any route family other than `workspaces`/`invites` — the only ones where the behavior exists today. |
| 3 | Technical detail | `requireCapability()`'s failure and `assertWorkspaceContext()`'s failure both throw `ApiError('forbidden', ...)` — same status, same `code`, different `message` string only. DoD separately promises a "clear, distinguishable error" for the workspace-unresolved case (AC3) but says nothing about distinguishability for the under-scoped case (AC2). | If "distinguishable" means a machine-readable reason code (not just human-readable message text), that's unbuilt; if it means the current message-text difference is sufficient, no dev work is needed here. | QA asserts on response body shape without knowing which bar to hold the fix to. |

### Edge cases not in Story
| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|---|---|---|---|
| 1 | A PAT holding multiple scopes but not the one required by the target route family (e.g. `['atc:write', 'run:execute']` calling a `workspace:admin`-gated route) | 403 — confirms scopes are non-overlapping / route-family-specific, not additive privilege | High | Add to refined ACs (**NEEDS PO/DEV CONFIRMATION** only on wording, not on mechanism — `requireCapability` is a straight `.includes()` check, so non-overlap is already implied by the existing code, not new behavior) |
| 2 | `invites/accept` (POST) — explicitly named by the cited design decision as an unresolved ADR-0001 "verify" item that was never completed | Unknown — the decision doc itself says this needs closing, does not commit to a posture | High | Ask PO/Dev directly (see Technical Question 3) |
| 3 | The existing regression test `app/api/v1/projects/[id]/traceability/route.test.ts:127-134` mints an `atc:write`-only PAT and POSTs to `modules/[id]/user-stories`, asserting **201** today — this test encodes the current gap as intended behavior | Must be updated to assert 403 (or whatever the module-create-adjacent posture resolves to) as part of this Story, or it stays green while describing the pre-fix contract | Critical | Add to Technical Questions for Dev — this is a "does the fix's own test suite change" risk, not a new test case QA needs to author |
| 4 | Session-cookie caller performs the exact same 7 write actions this Story guards | Continues to succeed unchanged (Business Rule 2 / DoD line 4) | High | Add explicit non-regression outline (see Phase 4 P5) |

### Contradictions
No contradictions found between the Story description, the 3 published ACs, and the Team Discussion comments — the comments (carrying over BK-97's two AI-authored rulings) are consistent with and clarify the Story's intent rather than conflicting with it. The one place a divergence exists is between the **ACs' wording and the current codebase's actual behavior** (not a Story-internal contradiction): AC2 and AC3's example routes already pass today, pre-implementation, which is documented above under "Central feasibility finding" and treated as a gap, not a contradiction.

### Testability validation
**Verdict**: Partial

Issues:
- AC1's precondition ("scoped to manage workspace modules") is not a literal, mintable scope value — see Ambiguity 1 (resolved above by citing the design decision, no blocker).
- AC2 and AC3, as literally written, test already-passing behavior on routes outside the 49-handler gap — testable, but they do not exercise this Story's actual deliverable. A test suite built strictly from the 3 published ACs would pass on the CURRENT, unfixed codebase, which means it provides zero regression signal for the actual fix (see Refined ACs below, which add gap-representative scenarios).
- The read-side of the DoD's own "every non-ATC route family ... checks" claim has no AC coverage at all (all 3 published ACs are write- or admin-oriented) and no code posture decided yet (Gap 1).

---

## Phase 3 — Refined Acceptance Criteria

### Original AC1 — A properly-scoped token succeeds on a non-ATC route

#### Scenario 1.1: Should create a module successfully with a PAT scoped `atc:write` (Type: Positive, Priority: Critical)
- **Given**: Karim holds a valid Personal Access Token scoped exactly `['atc:write']`, bound to workspace W where the underlying user is an active member of the project's workspace
- **When**: Karim sends `POST /api/v1/projects/{projectId}/modules` with a valid `{ name, description }` body using that token
- **Then**:
  - API: `201` with the created module in the response body
  - DB: a new row in `modules` for `projectId`, matching the request body
  - System state: no change to `access_tokens` (scope unaffected by use)

#### Scenario 1.2: Should bootstrap a workspace with any authenticated token, regardless of scope (Type: Positive, Priority: Medium) — **NEEDS PO/DEV CONFIRMATION**
- **NEEDS PO/DEV CONFIRMATION**: not literally in AC1, but directly implied by the cited design decision's own rationale — `POST /workspaces` must NOT require `workspace:admin` because minting an admin-scoped token requires already being admin of an existing workspace (unsatisfiable bootstrap deadlock otherwise). Confirm this stays a no-capability route (any valid, non-expired, non-revoked token succeeds) rather than being folded into AC1's "properly scoped" framing, which would incorrectly suggest a specific scope is required here.
- **Given**: Karim holds any valid PAT with at least one scope (empty-scope tokens cannot exist — DB CHECK `access_tokens_scopes_nonempty` enforces `array_length(scopes,1) >= 1`)
- **When**: Karim sends `POST /api/v1/workspaces` with a valid body
- **Then**: `201`, workspace created, Karim becomes its admin

### Original AC2 — An under-scoped token is rejected before any change happens

#### Scenario 2.1: Should reject module creation with a PAT scoped only `atc:read` (Type: Negative, Priority: Critical) — the actual gap-representative case
- **Given**: Karim holds a valid Personal Access Token scoped exactly `['atc:read']`
- **When**: Karim sends `POST /api/v1/projects/{projectId}/modules` with an otherwise-valid body using that token
- **Then**: `403` with an authorization error; **no** new row in `modules` (independent row-count check, not just status code)
- **Note**: as of this refinement, this route has **no** `requires` declared — the actual production behavior today is `201`. This scenario is the one that fails on unfixed code and passes once the Story ships; it is the regression test that matters most for this Story.

#### Scenario 2.2: Should reject invite creation with a PAT scoped only `atc:read` (Type: Negative, Priority: Medium — regression-lock, not new coverage)
- **Given**: Karim holds a valid Personal Access Token scoped exactly `['atc:read']`
- **When**: Karim sends `POST /api/v1/workspaces/{id}/invites` using that token
- **Then**: `403`; no new row in `invites` / no invite email sent
- **Note**: this is the Story's own literal AC2 example. It already passes on today's unfixed code (`workspaces/[id]/invites` POST already declares `requires: ['workspace:admin']`). Keep as a regression-lock, not as proof the Story shipped.

#### Scenario 2.3: Should reject a `workspace:admin`-gated action with a PAT holding unrelated scopes (Type: Negative, Priority: High) — **NEEDS PO/DEV CONFIRMATION** (wording only)
- **Given**: Karim holds a valid Personal Access Token scoped `['atc:write', 'run:execute']` (no `workspace:admin`)
- **When**: Karim sends `DELETE /api/v1/workspaces/{id}/invites/{inviteId}` using that token
- **Then**: `403`; invite row unchanged. Confirms scopes are route-family-specific and do not compose additively across unrelated capabilities.

### Original AC3 — A token with no resolvable workspace context is rejected

#### Scenario 3.1: Should reject a `workspace:admin` action with a PAT that has no workspace binding (Type: Negative, Priority: Medium — regression-lock, not new coverage)
- **Given**: Karim holds a valid Personal Access Token with `workspace_id = null` and scope `['workspace:admin']`
- **When**: Karim sends `PATCH /api/v1/workspaces/{id}`
- **Then**: `403` with message "This token is not scoped to a workspace; it cannot perform workspace-admin operations."; no change to the workspace row
- **Note**: this is the Story's own literal AC3 example, generalized. It already passes today (`assertWorkspaceContext()` runs on this exact route).

#### Scenario 3.2: Should succeed on a non-admin, non-ATC write with a PAT that has no workspace binding, when the underlying user is a real member (Type: Positive/non-regression, Priority: High) — **RESOLVED 2026-08-14**
- **RESOLVED (Critical Question 2, narrow reading confirmed)**: AC3 is explicitly scoped to the `workspace:admin` family only (today's actual `assertWorkspaceContext()` coverage). No expansion of `assertWorkspaceContext()` to the other 44 gap routes. Non-admin routes continue to rely on capability check + RLS membership alone — a PAT with no workspace binding is NOT rejected on these routes as long as the underlying user is a real workspace member.
- **Given**: Karim holds a valid Personal Access Token scoped `['atc:write']` with `workspace_id = null`, where the underlying user IS an active member of the target project's workspace
- **When**: Karim sends `POST /api/v1/projects/{projectId}/modules`
- **Then**: `201` — succeeds. Capability check passes (`atc:write` present) and RLS authorizes via real membership; no workspace-binding check applies outside the `workspace:admin` family.

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate
| Type | Count | Notes |
|------|-------|-------|
| Positive | 5 | Happy-path + bootstrap + read (`atc:read`) + session-parity variants |
| Negative | 7 | Under-scoped, non-overlapping scopes, revoked/expired, no-workspace-binding, missing `atc:read` on GET (added post-decision) |
| Boundary | 2 | Full-scope-set vs single-wrong-scope edges |
| Integration | 3 | RLS-independence, coverage-snapshot anti-rot, cross-family sweep (workspace-context generalization outline removed — resolved narrow, folded into Scenario 3.2 non-regression) |
| **Total** | **17** | |

**Post-decision update (2026-08-14)**: PO resolved all 3 Critical Questions during shift-left review. Net outline count unchanged (17) — the undecided read-posture and workspace-context-generalization placeholders converted into concrete, decided outlines rather than adding new surface area.

**Rationale**: This is a Decision-Table-shaped AC set (route family × verb × token-scope-state × workspace-binding-state, 2+ interacting conditions) layered on a centralized, already-proven mechanism. Rather than deriving one outline per each of the 7 route families × 2 verbs (14 combinations), outlines exercise the mechanism once per distinct decision-table rule on representative routes (`projects/[id]/modules` for the gap-write case, `workspaces/[id]/invites` for the already-covered admin case) and fold the remaining 5 write families + 6 read families into one explicit cross-family parametrized sweep outline (I4) — logging this reduction per the repo's pairwise/parametrization doctrine rather than silently capping coverage. HIGH risk (auth/security) justifies the Negative-heavy skew and the two undecided-behavior outlines (N3-equivalent 3.2, and the read-posture outline) being called out explicitly rather than guessed silently.

### Positive
- **Should create a module successfully with a PAT scoped `atc:write`** — Pre: token scoped exactly `['atc:write']`, user is workspace member. Expected: `201` + module row created. (Scenario 1.1)
- **Should bootstrap a workspace with any single-scope authenticated PAT** — Pre: any valid, non-revoked, non-expired token (min. 1 scope, per CHECK constraint). Expected: `201`, no capability required. (Scenario 1.2 — NEEDS PO/DEV CONFIRMATION on framing only)
- **Should read a non-ATC list/detail resource with a PAT scoped `atc:read`** — Pre: token holds `atc:read`. Expected: `200`. — **RESOLVED (Critical Question 1)**: `atc:read` required on GET across all 7 named route families, per the intent already documented at `app/qa/qa-config.ts:625`.
- **Should reject a non-ATC GET with a PAT missing `atc:read`** — Pre: token scoped e.g. `['run:execute']` only. Expected: `403`, no data returned. — new Negative outline added per Critical Question 1's resolution (moved here from the undecided placeholder).
- **Should invite a member successfully with a PAT scoped `workspace:admin` bound to that workspace** — Pre: token scoped `['workspace:admin']`, `workspace_id` = target workspace. Expected: `201`, invite created. (Regression-lock — already passing)
- **Should perform all 7 route-family actions unchanged via a cookie/session caller** — Pre: authenticated browser session (no PAT). Expected: identical success behavior to today, on every family, per Business Rule 2 / DoD line 4.

### Negative
- **Should reject module creation with a PAT scoped only `atc:read`** — Pre: token scoped exactly `['atc:read']`. Expected: `403` + no `modules` row created. (Scenario 2.1 — the gap-representative case; currently `201` on unfixed code.)
- **Should reject invite creation with a PAT scoped only `atc:read`** — Pre: token scoped exactly `['atc:read']`. Expected: `403` + no invite row. (Scenario 2.2 — regression-lock, already passing)
- **Should reject a `workspace:admin`-gated delete with a PAT holding unrelated scopes** — Pre: token scoped `['atc:write', 'run:execute']`. Expected: `403` on `DELETE /workspaces/{id}/invites/{inviteId}`, invite unchanged. (Scenario 2.3)
- **Should reject any capability-gated request with an expired PAT before the capability check ever runs** — Pre: token past `expires_at`. Expected: `401 unauthorized` ("Invalid token."), not `403 forbidden` — distinct failure path, resolved earlier in `requireBearerToken()`.
- **Should reject any capability-gated request with a revoked PAT before the capability check ever runs** — Pre: token with `revoked_at` set. Expected: `401 unauthorized`, same distinct-path reasoning as above.
- **Should reject a `workspace:admin` action with a PAT holding no workspace binding** — Pre: token `workspace_id = null`, scope `['workspace:admin']`. Expected: `403` "not scoped to a workspace" on `PATCH /workspaces/{id}`. (Scenario 3.1 — regression-lock, already passing)

### Boundary
- **Should succeed on the narrowest single-scope PAT that exactly matches a route's requirement** — Pre: token holds exactly 1 scope (the CHECK-constraint floor — empty arrays are impossible), and it is the correct one. Expected: `201`/`200` per route.
- **Should reject when the narrowest single-scope PAT holds the wrong single scope** — Pre: token holds exactly 1 scope, not the one required. Expected: `403`. Confirms the check is exact-match, not "any scope present."

### Integration
- **Should confirm the capability check does not bypass RLS** — Pre: PAT correctly scoped `atc:write` but the underlying user is NOT a member of the target project's workspace. Expected: `403` (mapped from Postgres `42501`) even though the TS-layer capability check passed — the two layers are independent (ADR-0001 Path B).
- **Should fail the route-capability coverage snapshot when a new route omits a posture** — Pre: `lib/api/route-capability-coverage.test.ts` exists (if the cited decision's Slice 1 lands as designed). Expected: the anti-rot test goes red for an undeclared posture, proving the fix is durable, not a one-time sweep. — Conditional on Slice 1 landing; verify at implementation time.
- **Should apply capability enforcement consistently across all 7 named route families** — Pre: parametrized sweep — one data row per (route, verb, required-scope) pair across imports, modules, projects, user-stories, acceptance-criteria, workspaces, invites. Expected: an under-scoped PAT is rejected identically (`403`, no DB change) on every row; a correctly-scoped PAT succeeds on every row. This is the literal DoD claim ("every non-ATC route family ... checks") collapsed into one parameterized artifact per the repo's Part 2.5 doctrine, rather than 12+ near-duplicate outlines.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|---|---|---|---|
| 1 | Multi-scope PAT missing only the one scope a route needs (Scenario 2.3 family) | No | High | Added to refined ACs (2.3) |
| 2 | `invites/accept` (POST) — capability posture explicitly left open by the cited design decision itself | No | High | **RESOLVED**: out of scope for BK-262 (Technical Question 3) — documented as follow-up debt |
| 3 | Existing regression test (`traceability/route.test.ts:127-134`) currently asserts the pre-fix (wrong) contract | No | Critical | **RESOLVED**: updated to assert `403` in the same PR (Technical Question 2) |
| 4 | Revoked/expired PAT reaching a capability-gated route | No | Medium | Added to refined ACs (Negative outlines 4-5) — already correctly handled today (401 before reaching the capability check), included as a non-regression case, not a gap |
| 5 | Read-side (`GET`) posture across the 7 families — entirely undecided by both Story and cited decision | No | Critical | Ask PO/Dev directly (Critical Question 1) |
| 6 | Workspace-context generalization beyond the 5 admin routes | No | Critical | Ask PO/Dev directly (Critical Question 2) |

---

## Story Quality Assessment

**Verdict**: Needs Improvement

**Key findings**:
- The underlying engineering thinking is unusually mature for a Story at this stage — two AI-authored decision records (BK-97's AI Product Owner + AI Tech Lead rulings) already resolve vocabulary reuse, enforcement shape, sizing (5-slice chain), and a concrete test strategy, and are carried into this Story's comments. This refinement does not need to re-derive any of that.
- But the 3 Jira-visible ACs lag behind that decision and, as literally written, are misleading about what this Story actually delivers: AC1 names a scope that doesn't exist (fixable by citing the decision), and AC2 + AC3's example routes are **already-passing behavior today**, so a test suite built strictly from the published ACs provides zero regression signal for the Story's actual deliverable (the 49-handler gap).
- The Story's own DoD line ("every non-ATC route family ... checks") has a read-side (GET) claim that neither the Story nor the cited design decision assigns a concrete posture to — this is the single highest-impact open question for both estimation and testability.

---

## Critical Questions for PO — ALL RESOLVED (2026-08-14, walked one at a time in shift-left review)

1. **RESOLVED — GET handlers across the 7 named route families require `atc:read`.** Rationale: consistency with the intent already documented at `app/qa/qa-config.ts:625`. Reflected in Refined ACs / Phase 4 outlines above.

2. **RESOLVED — AC3 ("no resolvable workspace context is rejected") is narrowed explicitly to the `workspace:admin` family** (today's actual `assertWorkspaceContext()` coverage: workspace PATCH + invites). No expansion of `assertWorkspaceContext()` to the other 44 gap routes — those rely on capability check + RLS membership alone, per the cited design decision's own scope. Reflected in Scenario 3.2 above (now a non-regression Positive, not an open question).

3. **RESOLVED — BK-262 reparented BK-183 → BK-1 "Tenancy & Identity".** Root cause: BK-262 was created from BK-97 (an Improvement), which correctly parents to the QA process epic (BK-183) per this repo's three-axis model — the Story inherited that parent by mistake on split-out. Corrected in Jira (`parent` + `Epic Link` fields) and in the local PBI folder path.

---

## Technical Questions for Dev — ALL RESOLVED (2026-08-14, walked one at a time in shift-left review)

1. **RESOLVED — grouped slices, not the full 5-slice chain nor a single PR.** Delivery groups into 2-3 PRs: Foundation + Authoring writes together, then Reporting reads + Identity/notifications + Docs together. Balances review size against ceremony overhead. QA plans re-test cycles per delivery group (2-3 cycles), not per individual slice (5) nor a single end-of-story cycle.
2. **RESOLVED — yes, `app/api/v1/projects/[id]/traceability/route.test.ts:127-134` is updated to assert `403` in the same PR that implements capability enforcement on `modules/[id]/user-stories`.** No test is left silently describing the pre-fix contract.
3. **RESOLVED — `invites/accept` (POST) is explicitly OUT OF SCOPE for BK-262.** Rationale: conceptually distinct from the other 48 gap routes — the caller is not yet a workspace member when accepting an invite, so no role/capability-in-that-workspace check can apply yet (same bootstrap-deadlock shape as `POST /workspaces`, resolved in Scenario 1.2). Documented as known follow-up debt, not designed or tested as part of this Story.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---|---|---|
| 1 | AC1: "a Personal Access Token scoped to manage workspace modules" | "a Personal Access Token scoped `atc:write`" | Testable, unambiguous precondition matching the already-decided scope vocabulary |
| 2 | AC2's example (`workspaces/[id]/invites` POST) already enforces `workspace:admin` today, before any Story work | Replace or supplement with a gap-representative write, e.g. module creation with an `atc:read`-only token expecting `403` (currently `201` in production) | The AC actually exercises the defect this Story fixes, not pre-existing, already-shipped behavior |
| 3 | ~~AC3 is silent on which of the 49 gap routes it targets~~ **RESOLVED** | Narrowed explicitly to the `workspace:admin` family (PO decision, Critical Question 2) | Ambiguity removed before Dev starts |
| 4 | DoD's "not only ATC routes" phrasing could be misread as ATC coverage being reworked by this Story | State explicitly that ATC-route enforcement is unchanged / out of scope (already covered by the same mechanism, 10 handlers) | Prevents accidental scope creep into already-correct ATC handlers during implementation |

---

## Data feasibility flags

No data feasibility risks identified. All required token states (single-scope, multi-scope, `workspace_id = null`, revoked, expired) are constructable via the existing `POST /api/v1/tokens` endpoint or the `mintPat()` test harness already used by the cited design decision's own test-strategy section (`lib/api/auth-coexistence.test.ts:81-94, 112-118`). No new entities, fixtures, or migrations are required — Out-of-Scope bullet 1 confirms the scope vocabulary itself is frozen for this Story.

---

## Recommended testing strategy

### Pre-implementation
- All Critical (PO) and Technical (Dev) questions resolved 2026-08-14 — see decisions above. No remaining blockers to estimation.
- Delivery groups: (1) Foundation + Authoring writes, (2) Reporting reads + Identity/notifications + Docs. QA plans 2-3 Ready-for-QA cycles, one per delivery group.

### During implementation
- Per delivery group, cross-check the routes it touches against the route-inventory table in this file (and the cited decision's own table) rather than waiting for the full chain to land before spot-checking.
- If the Foundation group's type change + coverage-snapshot test lands, treat a red coverage-snapshot diff as a fast per-PR signal that a route's posture changed — verify the new snapshot matches an intended, reviewed decision, not an accidental default.

### Post-implementation (in-sprint by /sprint-testing)
- Execute the full outline set with real minted PATs and real handler invocations plus an independent DB row-count assertion — per the cited decision's own test-strategy section, a mocked-principal 403 alone proves nothing; the contract test must observe the database.
- Explicitly re-verify the two "already-passing today" regression outlines (invite-create rejection, admin-route no-workspace-binding rejection) still pass after the change — they must not regress even though they predate this Story.
- Confirm `app/api/v1/projects/[id]/traceability/route.test.ts` was updated, not left asserting the pre-fix `201`.

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|---|---|---|---|
| 1 | Fix ships inconsistently across its 2-3 grouped PRs if delivery stalls partway | Low (grouping decided — Foundation+Authoring, then Reporting+Identity+Docs; codebase is "strictly better than today" even if it stalls after the first group) | Medium | Integration outline "cross-family sweep", verified per delivery group rather than only at the end |
| 2 | ~~Read-side (GET) posture ships inconsistently~~ **RESOLVED** — `atc:read` required, decided | Low (Dev still owns consistent implementation across the PR chain) | Medium | Positive outline "Should read a non-ATC list/detail resource with a PAT scoped `atc:read`" + Negative outline "Should reject a non-ATC GET with a PAT missing `atc:read`" |
| 3 | The existing `traceability/route.test.ts` PAT-parity test stays unmodified, silently describing the pre-fix contract and masking a future regression if the fix is reverted | Low | High | Technical Question 2 + explicit verification step in Recommended testing strategy |

---

## Next steps

- [x] PO answered Critical Questions 1-3 during shift-left review (2026-08-14)
- [x] Dev-facing Technical Questions 1-3 also resolved during the same shift-left review (2026-08-14) — PO made the call on delivery grouping, regression-test update, and `invites/accept` scope; Dev to confirm feasibility of the delivery grouping at estimation time
- [ ] Story enters sprint at `Ready For Dev` once estimated
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected) and add parametrization tables + test-data JSON + numbered steps on top of the outlines above
