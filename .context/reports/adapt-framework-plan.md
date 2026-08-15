> Generated: 2026-08-15
> Project: Bunkai
> Status: COMPLETED (2026-08-15) — see CLAUDE.md § "Framework Adaptation — /adapt-framework Closing Loop" for the closing summary

# Adapt Framework — Plan (closing-the-loop run)

## 0. Context — this is not a greenfield adaptation

This repo is **already substantially adapted**. `AuthApi.ts`, `LoginPage.ts`, `BugsApi.ts`, `WorkspaceApi.ts`, `NotificationsApi.ts` are real, live-verified components against Bunkai staging. `.agents/project.yaml`, `.env`, OpenAPI facades, auth setups, and CI env options are all populated with real data. This plan closes the **remaining GENERIC items** found in the Phase 0 scan — it does not re-derive auth strategy, entity mapping, or OpenAPI sourcing, all of which are already resolved.

## 1. Project Summary

- Stack: Next.js + Supabase + Vercel (backend/frontend), Supabase Postgres (DB)
- Auth: email+password sign-in (`POST /api/v1/auth/signin`), Bearer PAT + session cookie coexist, real selectors confirmed live 2026-08-15
- Entities already wired: Auth, Bugs, Workspace, Notifications
- OpenAPI: `api/openapi-types.ts` real (7892 lines), synced, facade boundary clean
- Environments: `local`, `staging` (both real URLs); `qa`/`production` intentionally `null` (not in QA scope)

## 2. Auth Strategy

Already resolved and implemented — no changes. TOKEN strategy (Bearer PAT in response body `pat.token`), session cookie set in parallel (coexistence invariant, BK-166 business rule). Per-run mint, no auto-refresh (accepted). `scripts/api-login.ts` already adapted (`.auth/tokens.env` populated).

## 3. OpenAPI Strategy

Already resolved — no changes. Source: real spec synced to `api/openapi-types.ts`. `api/schemas/auth.types.ts` real. Facade boundary clean (0 `@openapi` imports in `tests/components/`).

## 4. Identity + Variables

`.agents/project.yaml` already populated (project_name, project_key=BK, webapp_domain, backend/frontend stacks, db_type, issue_tracker, atlassian_url, default_env=staging, git_strategy). No changes needed except the MCP-name additions in §7.

## 5. Components to Create / Modify

### ATC decorator rename (real Jira Test issues found — no new TC creation needed)

Searched Jira via acli (`issuetype = Test AND summary ~ 'BK-166'`) — 4 real Test issues already exist, status `AUTOMATED`:

| File | Method | Current | New (real Jira key) |
|---|---|---|---|
| `tests/components/api/AuthApi.ts:73` | `authenticateSuccessfully` | `@atc('PROJ-101')` | `@atc('BK-311')` |
| `tests/components/api/AuthApi.ts:112` | `loginWithInvalidCredentials` | `@atc('PROJ-102')` | `@atc('BK-312')` |
| `tests/components/ui/LoginPage.ts:91` | `loginSuccessfully` | `@atc('PROJ-101')` | `@atc('BK-313')` |
| `tests/components/ui/LoginPage.ts:108` | `loginWithInvalidCredentials` | `@atc('PROJ-102')` | `@atc('BK-314')` |

Also drop the now-stale `TODO: Replace 'PROJ'...` comment lines in both files (AuthApi.ts:10, ExampleApi/ExamplePage — the latter deleted wholesale below).

### Files deleted (example artifacts)

```
tests/components/api/ExampleApi.ts
tests/components/ui/ExamplePage.ts
tests/components/steps/ExampleSteps.ts
api/schemas/example.types.ts
tests/e2e/module-example/
tests/integration/module-example/
tests/data/fixtures/example.json
```

### Files edited (strip example content, no new entity scaffolding — 4 real entities already exist)

- `tests/data/types.ts` — drop `TestHotel`, `TestBooking`, `TestCasePayload` (all 3 confirmed 0 usages outside module-example/DataFactory/types themselves). Keep `TestUser`, `TestCredentials`, `ApiState`.
- `tests/data/DataFactory.ts` — drop `createHotel`, `createBooking`, `createTestCase` + their imports. Keep `createUser`, `createCredentials`, `createTestId`.
- `tests/components/ApiFixture.ts` / `UiFixture.ts` / `TestFixture.ts` — remove `ExampleApi`/`ExamplePage` registrations + imports (verify BugsApi/WorkspaceApi/NotificationsApi/AuthApi/LoginPage remain wired — expected already present).
- `playwright.config.ts` — remove `testIgnore: ['**/module-example/**']` line (dead after deletion).

## 6. Env Vars + Secrets

No `.env` changes needed (`vars:check` / `vars:env:check` already pass). No new GitHub Secrets needed — CI workflow options already reconciled (§7 covers only the MCP-name fix, not new secrets).

## 7. CI + MCP + Reporting

### 7.1 kata-manifest

Regenerate after deletions + rename (`bun run kata:manifest`). Currently lists stale `PROJ-101/102`, `ExampleApi`, `ExamplePage` entries.

### 7.2 CI workflows

No changes — `local`/`staging` options already consistent across all 4 workflows.

### 7.3 MCP registry — dual-file drift fix

Current state does not match `project.yaml`'s declared server names:

| project.yaml expects | `.mcp.json` has | `opencode.jsonc` has |
|---|---|---|
| `staging-dbhub` | `staging-dbhub` ✓ | `dbhub` ✗ (rename) |
| `staging-openapi` | `openapi` ✗ (rename) | `openapi` ✗ (rename) |
| `local-openapi` | missing (add) | missing (add) |
| `local-dbhub` | missing | missing |

Planned fix:
1. Rename `openapi` → `staging-openapi` in both files (env: `API_BASE_URL`/`OPENAPI_SPEC_PATH` unchanged — staging values).
2. Rename `dbhub` → `staging-dbhub` in `opencode.jsonc` (matches `.mcp.json`, no `.mcp.json` change needed).
3. Add new `local-openapi` server in both files: same command, `API_BASE_URL=http://localhost:3000/api/v1` (real local Next dev value, already in `project.yaml`), `OPENAPI_SPEC_PATH` same spec source as staging (one spec file, not per-env).
4. **Remove `API_HEADERS: "Authorization:Bearer ${API_TOKEN}"`** from both `openapi`-derived servers — per `agentic-qa-core/references/api-testing-doctrine.md` the OpenAPI MCP is schema-read-only; authenticated calls go through `curl` + `.auth/tokens.env`, never the MCP. `API_TOKEN` itself is legacy/unused (per `.env` convention already documented). This was a genericness/doctrine violation in the current file, independent of the local/staging naming fix.
5. **`local-dbhub`**: per `.context/infrastructure/backend.md`, Bunkai has **no separate local Postgres** — local dev and staging share the same Supabase project (`dbhub.toml` has one `[[sources]] id="primary"`). Rather than add a duplicate MCP entry that is byte-identical to `staging-dbhub`, this plan points `project.yaml`'s `environments.local.db_mcp` at the existing `staging-dbhub` server (pragmatic deviation from the earlier "create separate local-dbhub" answer — flagged here for approval since the infra genuinely has one DB, not two). If a separate local DB is provisioned later, revisit.

### 7.4 dbhub.toml

No change — single `primary` source, already correct.

### 7.5 allurerc.mjs

Rename `name: 'Agentic QA Boilerplate'` → `'Bunkai Test Report'` (confirmed by user).

### 7.6 playwright.config.ts

Remove the `module-example` `testIgnore` line (§5).

## 8. Implementation Phases (execution order once approved)

1. Delete example artifacts (§5 file list)
2. Strip hotel/booking from `tests/data/{types,DataFactory}.ts`
3. Rename ATC decorators to real BK keys (§5 table) + drop stale TODO comments
4. Remove `ExampleApi`/`ExamplePage` fixture registrations; remove `testIgnore` line
5. Fix MCP dual-file drift (§7.3) + adjust `project.yaml` `environments.local.db_mcp`
6. Rename `allurerc.mjs`
7. Regenerate `kata-manifest.json`, run `kata:manifest:check`
8. Run validation gate (Phase 8 below)

## 9. AI Guidelines

- Components import from `@schemas/*`, never `@openapi`
- ATC decorators are Jira Test issue keys, string literals only
- No relative imports — use aliases
- Steps modules carry no `@atc`

## 10. Questions Answered

1. **ATC anchor for BK-166 login ATCs** → ran `/test-documentation` scoped search first; found 4 pre-existing AUTOMATED Test issues (BK-311/312/313/314) — used those, created nothing new.
2. **MCP local env** → "create real local-dbhub/local-openapi" chosen; `local-openapi` is genuinely distinct (different `API_BASE_URL`) so created as planned; `local-dbhub` revised to alias `staging-dbhub` after confirming Bunkai has no separate local database (see §7.3.5) — flagged for explicit approval since it deviates from the literal answer.
3. **Scope** → full GENERIC checklist in one pass, confirmed.

## 11. Discovery Gaps

- Allure report name (`Bunkai QA`) is a proposed default, not a confirmed user answer — adjust on approval if needed.
- `local-dbhub` deviation (§7.3.5) needs explicit sign-off since it differs from the literal "create separate server" answer.
- Production/QA environments remain intentionally unpopulated in `project.yaml` (out of current QA scope, staging is `default_env`) — unchanged by this plan.

## 12. Genericness Baseline (Phase 0 snapshot)

| Subsystem | State |
|---|---|
| project.yaml | ADAPTED |
| Real ATC keys (Bugs/Workspace/Notifications) | ADAPTED |
| AuthApi/LoginPage logic | ADAPTED |
| AuthApi/LoginPage `@atc` decorator | GENERIC → fixed by this plan |
| Example* components | GENERIC → deleted by this plan |
| module-example specs | GENERIC → deleted by this plan |
| DataFactory hotel/booking | GENERIC → stripped by this plan |
| kata-manifest.json | GENERIC (stale) → regenerated by this plan |
| OpenAPI facades | ADAPTED |
| .env / vars:check | ADAPTED |
| Auth setups | ADAPTED |
| Smoke tag | ADAPTED |
| allurerc.mjs | GENERIC → renamed by this plan |
| MCP dual-file | GENERIC (drift) → fixed by this plan |
| CI workflows | ADAPTED |
| business context | ADAPTED |

## 13. Approval Checklist

- [x] Delete `Example*` components + `module-example/` specs + `example.json`
- [x] Strip `TestHotel`/`TestBooking`/`createHotel`/`createBooking`/`createTestCase` from `tests/data/`
- [x] Rename 4 ATC decorators to `BK-311`/`BK-312`/`BK-313`/`BK-314`
- [x] Remove `ExampleApi`/`ExamplePage` fixture registrations + `testIgnore` line
- [x] Fix MCP dual-file naming (`staging-openapi`, `local-openapi`) + remove `API_HEADERS`/`API_TOKEN` injection from the OpenAPI MCP servers
- [x] Approve `local-dbhub` → alias to `staging-dbhub` in `project.yaml` (no new MCP entry, single shared DB)
- [x] Approve Allure name `Bunkai QA` (or provide alternative)
- [x] Regenerate `kata-manifest.json`

---

**WAIT for explicit user approval before starting Phase 3. Do not write code yet.**
