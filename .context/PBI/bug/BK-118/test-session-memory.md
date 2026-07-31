# Test Session Memory — BK-118

## Bug Summary
POST /api/v1/me/active-workspace still returns legacy `{ok, active_workspace_id}` fields alongside the BK-83 fix fields `{id, slug, name, role}`. Tech-debt cleanup filed after BK-83 closed.

## TMS Modality
jira-native (no Xray)

## Environment
- Active env: staging
- WEB_URL: https://staging-upexbunkai.vercel.app
- API_URL: https://staging-upexbunkai.vercel.app/api/v1

## Veto Decision
REQUIRE retesting — change touches the API response contract of an auth-adjacent endpoint (active workspace switch). Not pure text/CSS/docs/config with zero functional impact (removing fields IS a contract change), so veto-skip does not apply.

## Risk Score
LOW (2) — single-file, additive-to-subtractive field removal, isolated response builder (`response.ts`), dedicated regression unit test already merged, no auth-logic or DB-query changes, Impact stated as "no current consumer is broken."

## Code Analysis (Session Start)
- Backend repo was 81 commits behind `origin/staging` — pulled fast-forward to inspect real fix commits.
- Commits: `c702ad0` fix(BK-118) drop legacy fields, `8a48990` test(BK-118) regression test, `2191107` fix(BK-118) review nits.
- `route.ts` now calls `buildActiveWorkspaceResponse()` from a new `response.ts` module (BK-118 extracted the response-shape logic out of `route.ts` specifically to make it unit-testable in isolation).
- `response.ts` → `ActiveWorkspaceResponse` interface = `{id, slug, name, role}` only. `buildActiveWorkspaceResponse()` returns exactly those 4 keys — no `ok`, no `active_workspace_id`.
- `route.test.ts` (bun:test, 2 cases) asserts exact key set `['id','name','role','slug']` and explicit `not.toHaveProperty('ok'|'active_workspace_id')`, including the null-role case.
- Code review verdict: fix looks correct and matches the ticket's "Expected response shape after cleanup". Live staging verification still required (unit test ≠ deployed behavior).

## TMS Artifacts

### ATP
- **Written as**: field (`customfield_10067` — `🧪 Acceptance Test Plan (ATP)`) via REST PUT (acli edit rejects custom fields on existing items)
- **Jira confirmation**: HTTP 204; GET confirms 12 ADF nodes populated
- **Date written**: 2026-07-31

## Stage Results
### Planning (Stage 1)
- **Outcome**: COMPLETE — 2026-07-31
- **ATP written to**: `customfield_10067` on BK-118 (Bug Analysis variant: Reproduction, Root Cause Hypothesis, Fix Verification Plan TC1-TC3, Regression Surface, Data Integrity Check — N/A)
- **TC1 (P0)**: Response is exactly {id, slug, name, role}
- **TC2 (P0)**: bk_active_ws cookie regression guard
- **TC3 (P1)**: Non-member 403 regression guard

### Execution (Stage 2)
- **Outcome**: COMPLETE — 2026-07-31
- **Auth used**: existing `API_TOKEN` PAT from `.env` (`bun run api:login staging` still fails — known `access_token` vs `pat.token` key mismatch, same as BK-83)
- **Smoke**: `curl -sI https://staging-upexbunkai.vercel.app` → HTTP/2 307 (→ /login) ✓

#### TC Execution

| TC | Priority | Endpoint | Result |
|---|---|---|---|
| TC1 | P0 | POST /api/v1/me/active-workspace (member workspace `extra-test`) | PASSED |
| TC2 | P0 | Cookie `bk_active_ws` on switch | PASSED |
| TC3 | P1 | POST /active-workspace (non-member `first-smoke-test`) | PASSED |

#### TC1 Detail
- Response: `{"id":"9a2c3de7-...","slug":"extra-test","name":"Extra Test","role":"member"}`
- Sorted keys: `["id","name","role","slug"]` — exactly 4 keys, no `ok`, no `active_workspace_id`
- **Fix CONFIRMED on live staging** — matches unit test expectation exactly

#### TC2 Detail
- Cookie: `bk_active_ws=9a2c3de7-...; Path=/; Max-Age=7776000; Secure; HttpOnly; SameSite=lax` — unaffected by this change, still correct

#### TC3 Detail
- Non-member workspace `first-smoke-test` (27ef91be-...) confirmed via DB query (not in caller's `workspace_members`)
- Response: `403 {"error":{"code":"forbidden","message":"You are not a member of that workspace."}}` — auth gate untouched

- **Evidence**: `.context/PBI/bug/BK-118/evidence/tc1-post-response.json`, `tc1-response-headers.txt`, `tc3-non-member-403.json`

### Reporting (Stage 3)
- **Outcome**: COMPLETE — 2026-07-31
- **Verdict**: PASSED (3/3)
- **ATR written to**: `customfield_10147` on BK-118 (verified, 1 ADF node — code-block body)
- **QA comment**: Template C (Bug VERIFIED) posted via `acli jira workitem comment create -F`
- **BK-118 transition**: Ready For QA → Closed via `--status "Closed"` (transition name "ReTest Passed" as shown in Jira UI/API did not match acli's `--status` selector — acli matches by destination STATUS name, not the transition action's display name; used "Closed" instead — SUCCESS)
- **Local cache synced**: `bun run jira:sync-issues get BK-118 --include-comments`

## Bugs Found
(none yet)

## Observations
- Local backend checkout was stale (81 commits behind) — always fetch/pull before trusting a local read of a route file for retest analysis.

## Checklist

### Session Start
- [x] Bug fetched and synced (`bun run jira:sync-issues get BK-118 --include-comments`)
- [x] Code located (`route.ts`, `response.ts`, `route.test.ts`)
- [x] Veto evaluated → REQUIRE
- [x] Risk scored → LOW (2)

### Planning (Bug)
- [x] Bug analysis written (root cause, fix expected, test scope)
- [x] Test outline produced (TC1-TC3)
- [x] ATP written to Jira field (`customfield_10067`)

### Execution (Bug)
- [x] Smoke test passed
- [x] Retest actual staging response shape — CONFIRMED fixed
- [x] Evidence captured (3 files)

### Reporting (Bug)
- [x] ATR authored
- [x] QA comment posted
- [x] Ticket transitioned (→ Closed)

## Stage State
- Session Start: completed
- Stage 1 (Planning): completed — 2026-07-31
- Stage 2 (Execution): completed — 2026-07-31
- Stage 3 (Reporting): completed — 2026-07-31
