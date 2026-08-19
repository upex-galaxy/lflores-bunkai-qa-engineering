# BK-497: PAT | Require every API route to declare its capability posture
**Ticket:** BK-497 | **Epic/Module:** EPIC-BK-1-tenancy-identity | **Status:** Ready For QA | **Sprint:** n/a (not sprint-tagged in synced story.md)

> Jira-sourced detail (read-only caches, not copied here): `story.md`, `acceptance-criteria.md`, `business-rules.md`, `scope.md`, `out-of-scope.md`, `comments.md`, `implementation-plan.md` — materialized by `bun run jira:sync-issues get BK-497 --include-comments`.

## Team Discussion (analysis only — source is comments.md)

### Key Decisions
- [Ely] (2026-08-18 19:15): Ready for QA, merged to `staging` — PR #182, merge commit `ce9a38d7`, branch `feature/BK-497-route-capability-posture` (deleted post-merge). Explicitly framed as **behaviour-neutral by design**: no capability assigned to any previously-ungated route, no gate changed, no DB migration. QA question is "is everything still exactly as it was", not "does a new rule work".
- [Ely] (2026-08-18): This Story is a Foundation slice split off `BK-262` (ABORTED, split not abandoned) — the AI Product Owner / AI Tech Lead ruling scored the split 2026-08-17 and isolated this slice as "the only one touching all 68 route files", required to be independently revertible.

### Technical Notes
- [Ely] (2026-08-18): Full suite 1555 pass / 1 fail. The 1 failure is pre-existing and unrelated (`lib/runs/start-run.test.ts:129`, BK-34 run-steps chain order) — identical on untouched `staging` tip; baseline before this PR's edits was 1546 pass / same 1 fail. Delta is exactly the 9 tests this Story adds. Types clean, lint 0 errors.
- [Ely] (2026-08-18): AC-04/AC-05/AC-06 (the three non-regression scenarios in `acceptance-criteria.md`) were genuinely exercised, not skipped — all four Supabase env vars were present in this run, so the credential-gated suites (`rls-parity`, `auth-coexistence`, `workspace-context`, `pat`) ran with zero skips (17 tests).
- [Ely] (2026-08-18): The one real behavioural change — the hand-rolled bearer rejection on the two token routes moved into the gateway as a `cookie-only` posture — is proven by `app/api/v1/tokens/cookie-only-posture.test.ts`, which drives the real exported handlers with a real minted token: POST `/tokens` and DELETE `/tokens/{id}` return 403 with pre-lift messages preserved verbatim; DB confirms no token minted / target token still unrevoked; GET `/tokens` with the same token returns 200 (positive control).
- [Ely] (2026-08-18): Recommends a manual smoke on staging even though the suite already covers it: **issue a PAT from Settings, and revoke one** — the only two user-facing paths whose enforcement moved.
- [Ely] (2026-08-18): 46 of the 50 currently-ungated handlers carry a greppable `BK-498 pending` / `BK-499 pending` justification. Full 87-handler posture inventory is the committed snapshot `lib/api/route-capability-coverage.snapshot.json`.

### Edge Cases Raised
- [Ely] (2026-08-18): The coverage check is scoped to `app/api`; two bare gateway-free handlers exist outside that root (`app/auth/callback/route.ts`, `app/auth/oauth/[provider]/route.ts`) — deliberately not covered, recorded in-code, widening declined as out of scope for this Story. Flagged for BK-499's shift-left, not BK-497's QA scope.
- [Ely] (2026-08-18): `POST /invites/accept` keeps its deferred-debt justification; posture question genuinely open, never been through shift-left. Also flagged for BK-499, not this Story.

## Open Questions
1. **AC-coverage gap on the headline property** (source: Ely's comment, 2026-08-18) — the AI Product Owner's split ruling on BK-262 flagged that this Story's headline property — *"a new route cannot compile without declaring a posture"* — has **no acceptance criterion** among BK-262's original nine ACs (and therefore none inherited here either). It is tested (by the type-level enforcement + the coverage check) but never stated as a criterion; authoring one during delivery would have been inventing refinement, so it was deliberately left unwritten and recorded instead. This is worth raising explicitly in the Stage 1 Test Analysis / ATP — the three synced ACs (AC-04/05/06) only cover the non-regression guards on the 87-call-site migration, not the "handler with no posture fails to compile" property itself. Decide whether Stage 1 documents this as an AC-Delta / risk-beyond-AC test rather than silently skipping it, per test-design doctrine's "AC = floor not ceiling" principle.
2. Manual smoke suggested by the dev (issue a PAT from Settings + revoke one) is not itself an AC — confirm in Stage 1 whether it becomes a planned test step given it's the only user-facing surface the one real behavioural change touches.
3. Two out-of-BK-497-scope findings from Ely's comment (`app/auth/callback`/`app/auth/oauth/[provider]` bare handlers outside `app/api`; `POST /invites/accept` deferred-debt) are explicitly BK-499's shift-left concern, not this Story's — noted here only so QA doesn't mistakenly try to verify them under BK-497.

## Related Background (project-wide context, not ticket-specific)
- `.context/master-test-plan.md` flags Auth (magic-link + headless signin/signup/OTP) as **CRITICAL** risk tier — "security gateway; every flow sits behind it" — explicitly listing PAT minting as one of the guarded surfaces, and references prior real PAT-scope incidents (member-role PAT self-escalation, Bearer ignoring workspace switch — both since fixed) plus an unresolved residual-risk gap (GAP-14: ~136 pre-fix admin-scoped PATs never confirmed revoked). BK-497 sits directly in this risk tier: it is foundational plumbing for capability enforcement, not a leaf feature.
- This Story's own scope is explicitly non-functional/type-level + one narrow behavioural lift — it does not itself assign any new capability gate, so it should not be tested as if it changes authorization outcomes broadly. BK-498/BK-499 (successors) are where new capability assignments land.

## Next Step
Story workflow (US path) — Stage 1 Planning next.
