# Test Automation Plan: BK-864

> Ticket: BK-864 (TC1 of Story BK-259): e2e, hybrid (API seeding, UI assertion)
> Scope: bug-driven (Micro): one signed Candidate TC
> Created: 2026-11-15

## 1. Summary

- What to test: the Home "Coverage" card shows the workspace percentage and three chips that add up to the total ACs, when the workspace holds executed, awaiting and uncovered ACs.
- Source gate: BK-864 at `Candidate`, `Verdict signed:` comment of 2026-11-15 (12:06 -0300), before this run.
- Data strategy (decided by the user, 2026-11-15): Generate through the API and compare against a baseline.
- Dependencies: none. Follow-ups BK-879, BK-880, BK-1915 reuse `HomePage` and the seeding Steps.

## 2. Architecture Decisions

| Decision | Value | Rationale |
|---|---|---|
| UI component | NEW `HomePage` (`tests/components/ui/HomePage.ts`) | No page object owns `/home` (checked `kata-manifest.json`: only `LoginPage`). Registered in `UiFixture`. |
| API helper | `getWorkspaceCoverage(id)` added to the existing `CoverageApi` | Reuse, no new Api class. Read-only GET that only prepares data, so a helper (`@step`), not an ATC (Rule 7). |
| Seeding | NEW Steps class `CoverageSeedSteps` (`tests/components/steps/`) | A 10-call precondition chain; three queued TCs (BK-879/880/1915) need the same chain. Not an ATC and not registered in any fixture: instantiated in the test. |
| Fixture | `{ test }` (hybrid) | API to seed and to read the oracle, UI to assert. |
| Identity | `owner` (the UI session user is the owner of `QA_WORKSPACE_ID`) | Seeding through the API must write into the same workspace the UI session reads. Verify in Code that the UI Home shows `QA_WORKSPACE_ID`. |
| Test file | `tests/e2e/home/showWorkspaceCoverage.test.ts` | verb + Feature |
| Oracle | API rollup `GET /workspaces/{id}/coverage` AFTER seeding, and the delta against the BEFORE read | UI numbers are independent of the seed rule only if compared to something other than themselves. |

## 3. ATC Registry

| ATC ID | Component | Method | Status |
|---|---|---|---|
| BK-864 | HomePage | showWorkspaceCoverage | NEW |

## 4. Files

| File | Action |
|---|---|
| `tests/components/ui/HomePage.ts` | create (ATC `showWorkspaceCoverage`, navigates to `/home` itself) |
| `tests/components/UiFixture.ts` | register `home` |
| `tests/components/api/CoverageApi.ts` | add helper `getWorkspaceCoverage` |
| `tests/components/api/RunsApi.ts` | create (helper `submitRun`) |
| `api/schemas/runs.types.ts` | create (facade for `POST /runs/submissions`) |
| `tests/components/ApiFixture.ts` | register `runs` (property, constructor, set/clear token) |
| `tests/components/api/AuthoringSweepApi.ts` | add helper `deleteUserStory` (cleanup) |
| `tests/components/steps/CoverageSeedSteps.ts` | create (`seedAcStates`, `cleanup`) |
| `tests/e2e/home/showWorkspaceCoverage.test.ts` | create (seed in the test, cleanup + baseline check in `afterEach`) |
| `kata-manifest.json` | regenerate (`bun run kata:manifest`) |

## 5. Test data (Generate)

Seeded inside the reserved QA workspace, in `QA_WORKSPACE_MODULE_ID`, under ONE new user story:

| AC | ATC bound | Run | Resulting state |
|---|---|---|---|
| AC-A | ATC-A (+ a Test chaining ATC-A) | one finished passing run, submitted with a workspace-bound `run:execute` PAT minted for the call and revoked after | executed |
| AC-B | ATC-B (no Test, no run) | none | awaiting execution |
| AC-C | none | n/a | no coverage |

The run reuses an environment the project already has (discovered, never created).
Names carry `createTestId()` so repeated runs never collide.
Cleanup: `CoverageSeedSteps.cleanup()` runs in `afterEach` on an instance the test creates BEFORE seeding. The instance records the story id and the PAT id the moment each exists, so it also cleans up after a failure or a timeout in the middle of the seed, not only after a complete one. It revokes any PAT whose revoke was not confirmed, archives the story (`DELETE /user-stories/{id}` archives its ACs and ATCs in one transaction), reports every failure together by id, and is followed by a re-read of the rollup that must equal the baseline. A call still in flight when Playwright disposes the request context at a timeout can fail and leave data; that residual window is small and visible only as a failed hook.

## 6. Risks

- RESOLVED in Code. Home vs `QA_WORKSPACE_ID`: `GET /me` reported `active_workspace_id` = `QA_WORKSPACE_ID` for the owner on 2026-11-15, and the Home falls back to the oldest membership when there is no `bk_active_ws` cookie (`lib/workspaces/active.ts`). It is not asserted by the test: if the owner's memberships change, the failure shows up as `card.total != after.ac_total`.
- RESOLVED in Code. The cached owner PAT carries `atc:read`, `atc:write` and `run:execute` but is NOT bound to a workspace, so `POST /runs/submissions` answers 403 `token_not_workspace_scoped`. The Steps mints a workspace-bound `run:execute` PAT (1 day) for that one call and revokes it.
- RESOLVED in Code. There is no coverage cache in the app any more: the memo was removed with BK-1169 (`lib/home/coverage.ts`), so the baseline-then-after read pair is sound. A cache would make the delta assertions fail loudly, never pass silently.
- Decision (user, 2026-11-15, Review round 3): the `@atc('BK-864')` verdict covers only what must always hold on the screen (percentage shown, chips visible, chips sum to the total). The UI-versus-API comparison, the deltas and the independent percentage live in the TEST, as KATA's fixed versus test-level split prescribes. Consequence accepted knowingly: the ATC result written to the TMS can read PASSED while the test fails on a test-level assertion. Chosen over making the ATC take the expected reading, which would tie it to seeded data and make it harder to reuse for BK-879, BK-880 and BK-1915.
- Known and accepted (Review round 5, user decision 2026-11-15): token exposure on a FAILED REQUEST. When `submitRun` or `deleteUserStory` fails at the network level (a timeout or a connection error), Playwright's error text includes a call log with every request header, `Authorization: Bearer ...` among them (`playwright-core` `coreBundle.js`, the fetch log writes each header unredacted; checked 2026-11-15). That text reaches the test error, the HTML report and CI logs. Applies to the minted `run:execute` PAT (1 day, bound to the QA workspace, revoked right after the call) and to the owner's ambient token, which every API test in the repo already carries. Allure attachments and step titles ARE redacted; thrown error text is not. Not mitigated in code: the fix is to pass those messages through `redactSecretString` (`tests/utils/allure.ts`) and, project-wide, to review `trace: 'retain-on-failure'` in `playwright.config.ts` for e2e (a failing LOCAL run also keeps the PAT in `trace.zip`; CI has traces off). Reopen if the PAT scope or lifetime grows.
- Open and accepted: the delta and the restored-to-baseline assertions assume nobody else writes ACs, ATCs or runs in the QA workspace during the ~10 s of the test. The suite runs with `workers: 1`; a CI regression run or manual testing in the same workspace at that moment could fail it falsely.
- Residual data grows the workspace totals each run. Delta assertions absorb it; a percent assertion on absolute numbers would not.
- Known, accepted residue (Review round 1, 2026-11-15): every run leaves ONE Test and ONE finished Run in the QA workspace. The API has no delete or archive for either (`/tests/{id}` and `/runs/{id}` expose GET only, verified in `api/openapi.json`), so it cannot be cleaned up from the test. The story, its ACs and its ATCs ARE archived, and the test verifies the rollup is back to its baseline. If the Test or Run counts of the QA workspace start to matter to another suite, that needs an API change, not a test change.
- The minted `run:execute` PAT is revoked after the run and the revoke status (204) is asserted; a failed revoke fails the test naming the PAT id (never its value).

## 7. Test-Design Checklist

- [x] AC1 traced to an ATC; AC2 (no prior-period delta) is out of this TC (D24, no invented trend)
- [x] EP: the three AC states are three partitions, all present in ONE flow because the TC asserts their coexistence; boundaries (0%/100%) belong to BK-879/880/1915
- [x] Risk beyond the AC: chips sum equals total (the §4.7 "bound is not verified" distinction)
- [x] Parametrize: N/A (one scenario, no same-behavior variants)
- [x] No ATC calls another ATC (seeding is a Steps class)
