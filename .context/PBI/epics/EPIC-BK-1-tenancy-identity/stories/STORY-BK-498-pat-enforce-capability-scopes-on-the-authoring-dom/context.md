# BK-498: PAT | Enforce capability scopes on the authoring domain
**Ticket:** BK-498 | **Epic/Module:** EPIC-BK-1-tenancy-identity | **Status:** In Test | **Sprint:** n/a (not sprint-tagged in synced story.md)

> Jira-sourced detail (read-only caches, not copied here): `story.md`, `acceptance-criteria.md`, `business-rules.md`, `scope.md`, `out-of-scope.md`, `comments.md`, `implementation-plan.md` — materialized by `bun run jira:sync-issues get BK-498 --include-comments`.

## Team Discussion (analysis only — source is comments.md)

### Key Decisions
- [Ely] (2026-08-19 19:04): AI Product Owner ruling — the ratified verb mapping (GET → `atc:read`, POST/PATCH/DELETE → `atc:write`) is kept UNCHANGED for the imports workflow, even though it means a token scoped exactly `atc:write` (the shape AC-01 explicitly blesses) gets `403` polling its own import job via `GET /imports/{id}` (which requires `atc:read`). Alternatives (any-of scope semantics, or gating the status read on `atc:write`) were scored and rejected — the capability gateway's `requires: NonEmpty<Capability>` is AND-semantics only, and reopening that would re-litigate BK-497's already-ratified machinery. Documented as a discoverable requirement in the OpenAPI spec rather than changed in code. **Not a defect** — an automation client driving imports end-to-end needs both `atc:read` and `atc:write` (which `DEFAULT_PAT_SCOPES` already grants by default).
- [Ely] (2026-08-19 19:12): Ready for QA — PR #186 merged to `staging` via merge commit `0becadc`, branch `feature/BK-498-enforce-capability-scopes-authoring-domain`. No migration. Assigned Luis as QA owner (inherits BK-262's 2026-08-14 shift-left refinement).

### Technical Notes
- [Ely] (2026-08-19): All 22 authoring-domain handlers now require a capability — until this merge they required none, so a read-only token could create/delete authoring content. Evidence: `lib/api/capability-enforcement.test.ts` (DB-integration, real handlers + real minted PATs against live DB, independent service-role read-back) and `lib/api/route-capability-coverage.test.ts` (holds all 22 handlers to the verb mapping so a future edit that weakens a posture fails the suite).
- [Ely] (2026-08-19): Known limitation, disclosed by dev — the DB-integration suite is credential-gated (`describe.skip` without Supabase env, per the standing BK-262 Tech Lead ruling / ADR-0012). It was run against the live DB this cycle and passed, but a CI run without credentials would report green having executed none of it. Consistent with this QA repo's already-logged "no CI in target repo" HIGH risk (see Project Assessment in root CLAUDE.md).
- [Ely] (2026-08-19): Tokens minted through the UI get `DEFAULT_PAT_SCOPES` (`atc:read` + `atc:write` + `run:execute`), so a default token loses nothing from this change. Observing the gate requires a **deliberately narrowed** token — confirmed independently this session: `.auth/tokens.env`'s role tokens (OWNER/USER/MEMBER/VIEWER/ADMIN/INACTIVE) are all default-scoped, none are narrow. Narrow single-scope PATs must be minted live in Stage 2 (see Test Data in `test-session-memory.md`).

### Edge Cases Raised
- [Ely] (2026-08-19): BK-498 and its sibling BK-499 (read/identity/notification/workspace routes, still `Backlog`) must merge **sequentially** — both rewrite `lib/api/route-capability-coverage.snapshot.json`, whose test asserts exact array equality. Not a BK-498 QA concern directly, but worth knowing if BK-499 lands mid-session.

## Open Questions
1. **Import dual-scope requirement is a deliberate design decision, not a defect** — Stage 1 test design must document `POST /imports` (atc:write) + `GET /imports/{id}` (atc:read) as two independently-gated endpoints so a `403` on a write-only token polling its own import is correctly classified as expected behavior, not a regression. Flagged so Stage 2 execution does not mis-file this as a bug.
2. **Module context still missing.** `EPIC-BK-1-tenancy-identity/module-context.md` does not exist — same gap BK-497's Session Start left open (BK-497 also deferred it, framing it as "epic-level, reusable, out of read-only Session Start's explicit scope"). Carried forward again; Stage 1 to decide whether to create it now that two Stories in this epic have skipped it.
3. **Test data for narrow-scoped PATs.** Unlike BK-497's AC-06 (which hit a genuine issuance-guard block for `workspace:admin` unbound tokens), BK-498's AC-07 ("no workspace binding, `atc:write` scope") is NOT blocked by `assertTokenIssuanceAuthorized` — that guard only fires for `workspace:admin` requests (per `lib/api/pat.ts`, confirmed by direct read this session). So AC-07's precondition (unbound `atc:write` PAT) should mint cleanly via the same cookie-session flow BK-497 proved out. No BK-497-style substitute-check workaround is expected to be needed — confirm in Stage 1/2.

## Related Code
### Backend (upex-bunkai-tms) — confirmed by direct code read this session
- `lib/api/handler.ts:74-101` (`withApiHandler`) — confirms the capability gate ordering: for `auth: 'required'`, `requireCapability(principal, capability)` runs for every entry in `options.requires` **before** `handler(request, ctx)` is invoked. This is what satisfies BK-498's DoD clause "rejected with 403 before any change happens."
- `lib/api/principal.ts:84-88` (`requireCapability`) — throws `ApiError('forbidden', ...)` if `!principal.capabilities.includes(capability)`.
- `lib/api/pat.ts` — `DEFAULT_PAT_SCOPES` (atc:read + atc:write + run:execute); `ALLOWED_PAT_SCOPES = ALL_CAPABILITIES`.
- `app/api/v1/tokens/route.ts:108` — `POST /api/v1/tokens` is `auth: 'cookie-only'` ("Personal access tokens cannot issue tokens. Use a browser session.") — confirms PATs cannot mint other PATs; narrow-scope test tokens require a cookie session, same as BK-497.
- `app/qa/qa-config.ts:625-626` — published scope vocabulary QA contract: `atc:read` ("Leer ATCs, steps, assertions, modules, user stories, AC. (DEFAULT)"), `atc:write` ("Crear / actualizar / borrar ATCs. (DEFAULT)").
- The 22 authoring-domain handlers (11 route files), all confirmed declaring the correct posture this session:

  | File | Handlers | Posture |
  |---|---|---|
  | `app/api/v1/acceptance-criteria/[id]/route.ts` | GET / PATCH / DELETE | `atc:read` / `atc:write` / `atc:write` |
  | `app/api/v1/environments/[id]/route.ts` | PATCH / DELETE | `atc:write` / `atc:write` |
  | `app/api/v1/imports/[id]/route.ts` | GET | `atc:read` |
  | `app/api/v1/imports/route.ts` | POST | `atc:write` |
  | `app/api/v1/milestones/[id]/route.ts` | PATCH | `atc:write` |
  | `app/api/v1/modules/[id]/route.ts` | PATCH / DELETE | `atc:write` / `atc:write` |
  | `app/api/v1/modules/[id]/user-stories/route.ts` | POST / GET | `atc:write` / `atc:read` |
  | `app/api/v1/projects/[id]/environments/route.ts` | GET / POST | `atc:read` / `atc:write` |
  | `app/api/v1/projects/[id]/milestones/route.ts` | GET / POST | `atc:read` / `atc:write` |
  | `app/api/v1/projects/[id]/modules/route.ts` | POST | `atc:write` |
  | `app/api/v1/user-stories/[id]/acceptance-criteria/route.ts` | POST / GET | `atc:write` / `atc:read` |
  | `app/api/v1/user-stories/[id]/route.ts` | GET / PATCH / DELETE | `atc:read` / `atc:write` / `atc:write` |

  Total: 22/22 handlers with declared capability posture, matching the DoD exactly (7 GET → `atc:read`, 15 POST/PATCH/DELETE → `atc:write`, per the verb-mapping table in `implementation-plan.md`).
- `lib/api/capability-enforcement.test.ts`, `lib/api/route-capability-coverage.test.ts` + `.snapshot.json` — dev evidence (not independently re-run this session; DB-integration suite is credential-gated per Technical Notes above).

### Database (Supabase Postgres) — confirmed via `staging-dbhub` MCP this session
- `access_tokens` table: 10 columns (`id, user_id, workspace_id, name, token_prefix, scopes[], expires_at, revoked_at, last_used_at, created_at`), 2467 rows. Only `token_prefix` + a SHA-256 hash are stored — raw secrets are never persisted, so existing rows cannot be reused as bearer credentials; new narrow-scope tokens must be minted live in Stage 2.
- `modules` / `projects` tables — several pre-existing QA-fixture projects available as candidate authoring entities (see Test Data in `test-session-memory.md`).
- `supabase/migrations/0008*access*tokens.sql:34-36` — scope-vocabulary CHECK constraint, confirmed untouched by dev (no migration in this Story, per implementation-plan.md).

## Related Background (project-wide context, not ticket-specific)
- `.context/master-test-plan.md` flags Auth/PAT as **CRITICAL** risk tier (same tier BK-497 sits in) — this Story is the first of the two successor Stories to actually flip a capability gate ON for a domain (BK-497 was deliberately behaviour-neutral).
- BK-498 depends on BK-497 (QA Approved 2026-08-19) — this Story's routes consume BK-497's compile-time posture union; BK-497's coverage snapshot already carried "BK-498 pending" justifications for these 22 handlers, now resolved.

## Final Status
**Result:** Pending — Session Start only. Stages 1-3 not yet run.
**Next:** Awaiting user confirmation of the Story Explanation before Stage 1 Planning begins.
