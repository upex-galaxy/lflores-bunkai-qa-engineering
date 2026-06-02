# Shift-Left Refinement: BK-9 — TMS-Module | Create modules with nested sub-modules

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-06-02
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context

- **Primary persona affected**: Senior QA Engineer (Elena) — needs a structured, hierarchical module tree to mirror product areas before anchoring User Stories and ATCs
- **Secondary personas (if any)**: QA Lead (Mateo) — configures the project taxonomy; Viewer — reads the module tree for orientation
- **Business value proposition**: Without module creation, the entire traceability chain collapses — ATCs cannot be anchored to a structured location. Modules are the prerequisite for every downstream artifact (US, AC, ATC). This story unblocks the core product workflow.
- **KPI(s) influenced**: ATC coverage coverage rate (ATCs must live in modules); project onboarding time (flat lists slow navigation); product-area traceability completeness
- **User journey position**: Step 2 in the Setup Flow — after workspace and project creation, before User Story and ATC authoring. Blocks everything downstream.

### Technical context

- **Frontend**: No create UI exists yet — `Sidebar` component currently read-only; `buildModuleTree()` utility in `lib/tree.ts` handles the flat-to-tree conversion that any new module must feed into; project page at `/projects/{slug}` would host the create trigger
- **Backend**: No `POST /api/v1/modules` endpoint exists (confirmed via `app/api/v1/` directory — modules directory absent). No Server Action for module creation. The `modules` table IS live in Supabase DB. Business-data-map.md §Flow 2 documents the intended flow: `POST /api/v1/modules` → DB insert → path computed → position assigned. BK-9 must create this endpoint and Server Action (or equivalent pattern).
- **External services**: None (module creation is internal — no Jira, no email, no storage)
- **Integration points specific to this Story**:
  - `modules` table — self-referential FK (`parent_module_id`), materialized `path` column, `position` for sibling ordering
  - Depth counting: DB-level or app-level recursive CTE to count ancestors (not yet confirmed which layer enforces it)
  - `projects` table — module must belong to an existing project
  - RLS: user must be `member` or above in the workspace (`workspace_members.role IN (member, admin, owner)`)
  - Supabase Realtime: tree node must refresh in open browser tabs after create (pattern established by ATC create flow)
  - `activity_log`: INSERT expected on module create (cross-cutting pattern; not confirmed for this entity)

### Story complexity

| Axis | Rating | Why |
|------|--------|-----|
| Business logic | High | Self-referential tree with materialized path, depth enforcement (two thresholds), position ordering, and RLS scoping — all in one operation |
| Integration | Medium | Internal only (DB + RLS), but tree integrity constraints require careful ordering: project must exist, parent module must exist in same project, depth must be recomputed on each insert |
| Data validation | High | Name length (2–80), depth threshold (soft warn at 4, hard block at 6), parent ownership (parent must belong to same project), null parent = root |
| UI | Medium | Tree insert must be reflected immediately in the sidebar; position within siblings must be deterministic; warning toast vs. error toast per depth |

**Estimated test effort**: HIGH — 5–7 story points equivalent. Depth state machine × 3 paths (normal / warn / block), tree integrity invariants, RLS cross-workspace isolation, path computation correctness, and position ordering under concurrent creates all require dedicated coverage. This is not a simple CRUD story.

### Epic-level inheritance (BK-7)

- **Risks restated at Story level**:
  - Cascade soft-delete (BK-10 dependency) is NOT in scope for BK-9 but creates a constraint: BK-9 must not design the schema in a way that makes BK-10's `archived_at` column addition disruptive
  - Cycle detection (BK-11 dependency) is not in scope, but BK-9's parent-module validation must ensure the parent belongs to the same project (simpler check than cycle detection but related)
  - `modules.path` materialized column: any bug in path computation in BK-9 propagates to BK-10 (rename/reparent) and BK-11 (move)
- **Integration points inherited**: `projects` table as parent (project must exist and be RLS-accessible); `workspace_members` RLS chain
- **PO/Dev answers already given at epic level**: Maximum depth = 6 levels. Testing requirements: Unit (cycle detection, slug derivation, path-rebuild), Integration (full CRUD lifecycle 4-depth subtree), E2E (Playwright: user creates Project → Modules → sub-modules in tree view)
- **Test strategy inherited**: Unit tests for path computation and depth counting; Integration tests for the full 4-level subtree lifecycle; E2E Playwright for the user journey

---

## Phase 2 — Story Quality Analysis

### Ambiguities

| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|-------------------|---------------------|-------------------|------------------------|
| 1 | AC4 + Business Rules: "depth 4 or deeper" | The business rule says "Creating at depth 4 or deeper returns a soft warning" but AC4 says "Given a chain of Modules already nested 4 levels deep / When I add a sub-module at the 5th level" — which depth level triggers the warning: depth 4 or depth 5? The AC implies the warning fires when CREATING at level 5, meaning the parent is at level 4. The business rule says "at depth 4 or deeper." Is the warning triggered by the RESULTING depth (5) or the PARENT depth (4)? | Cannot write deterministic assertion for warning boundary — test at level 4 may or may not show warning | Clarify: warning fires when resulting depth >= 5 (i.e., parent is at level 4 or deeper) OR when resulting depth >= 4. Recommend: "warn when resulting depth is 5 or 6" |
| 2 | AC1 — "selectable as a parent for new sub-modules" | This implies that after creating a root module, the UI immediately reflects it as a valid parent target. Is this enforced via a UI refresh (Supabase Realtime?) or is it a static rebuild of the form's parent-select dropdown? | Cannot validate "immediately selectable" without knowing the refresh mechanism | Specify the UI update mechanism: optimistic update, Realtime subscription, or page reload |
| 3 | AC2 — breadcrumb reads "Payment / Refunds" | Is the breadcrumb separator " / " (space-slash-space) exactly? Does the breadcrumb use the display name or the `path` slug from the DB? The materialized `path` column uses `/Payment/Refunds` format (forward-slash delimited, no spaces). | Exact UI assertion depends on separator and source | Confirm breadcrumb separator character and whether it renders `modules.name` or derives from `modules.path` |
| 4 | Business Rules — "Description: Optional, written in Markdown" | No AC covers the description field at all. Is there a character limit on description? Is it rendered as Markdown in the UI immediately on create, or only on a detail view? | No test coverage planned for description without these answers | Add an AC or note: max description length (recommend 2000 chars), confirm Markdown preview is in or out of scope for BK-9 |
| 5 | Business Rules — no maximum name length AC | Business rule states name 2–80 characters. No AC covers the 80-char maximum. Is 80-char name accepted, and is 81-char name rejected with a specific error message? | Upper boundary is untested without explicit AC | Add AC or test note: name of exactly 80 chars accepted; name of 81+ chars rejected with message "name must be at most 80 characters" |

### Gaps (missing info)

| # | Type | Why critical | What to add | Risk if omitted |
|---|------|--------------|-------------|-----------------|
| 1 | Technical detail | No API endpoint or Server Action yet — BK-9 must create it. Business-api-map.md confirms `GAP-3: No Module write API or Server Action`. The implementation pattern (API route vs. Server Action) is unspecified. | Confirm: will module creation follow the REST pattern (`POST /api/v1/modules`) or use a Supabase RPC/Server Action like ATC save does? | Test strategy diverges completely depending on pattern: API = curl-testable; Server Action = browser-only or Supabase client direct |
| 2 | Technical detail | Depth computation mechanism is unspecified. Business-data-map.md §Flow 2 mentions "depth check: count ancestors via recursive CTE" but does not confirm if this is enforced at DB layer (trigger/constraint) or app layer. | Confirm: is depth capped by a DB trigger, a Supabase RPC, or app-layer logic before INSERT? | If app-layer only, a direct DB INSERT or API call bypassing the handler can violate the 6-level cap — RLS alone does not prevent it |
| 3 | Technical detail | Position ordering on create. The `position` column determines sibling order. What value does a newly created module receive? Last-sibling+1 (append)? User-specified? What happens if two modules are created concurrently with the same intended position? | Document: position assignment strategy on create — append (last+1) or user-specified | Concurrent creates can produce collisions in position values, making the sort non-deterministic |
| 4 | AC gap | No error scenario for unauthorized creation. The story has no AC for "viewer tries to create a module." Business rules say "Visible only to members of the owning Workspace" but the required role for write is not stated explicitly in this story. Business-data-map.md §7 states `member+` for CRUD on Project entities. | Add AC: viewer-role user attempting module creation receives 403 (or UI disables the create button entirely) | Privilege escalation if viewer can create modules via API |
| 5 | AC gap | No error scenario for mismatched project ownership. If `parent_module_id` points to a module in a different project, should the API reject it with a specific error? | Add AC: parent module from a different project is rejected | Cross-project module trees would break the "belongs to exactly one Project" ownership rule |
| 6 | Business rule | No Idempotency-Key behavior documented. Business-api-map.md notes `lib/api/idempotency.ts` is implemented but not wired to any live endpoint. Will module creation support idempotency? | Confirm: does `POST /api/v1/modules` support `Idempotency-Key` header? | Double-submit (network retry) could create duplicate root modules with the same name in the same project |

### Edge cases not in Story

| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|----------|-------------------------------|-------------|--------|
| 1 | Module name at exact minimum boundary: exactly 2 characters | Accepted with no error | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 2 | Module name at exact maximum boundary: exactly 80 characters | Accepted with no error | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 3 | Module name of 81 characters (one over maximum) | Rejected with "name must be at most 80 characters" | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 4 | Module name with leading/trailing whitespace (e.g., "  Payment  ") | Name is trimmed before save, or rejected with validation error | Medium | Ask PO — trimming is friendlier but surprising if the stored name differs from typed input (NEEDS PO/DEV CONFIRMATION) |
| 5 | Module name with only whitespace (e.g., "   ") | Rejected as empty / invalid | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 6 | Duplicate module name within the same parent (sibling with same name) | Accepted (no uniqueness constraint stated) or rejected with error | Medium | Ask PO — uniqueness within a sibling group is a common UX expectation not stated in business rules (NEEDS PO/DEV CONFIRMATION) |
| 7 | Duplicate module name across different parents in same project | Accepted — path would be different | Low | Test only — expected behavior is clear from the path model |
| 8 | Module name with special characters: emoji, RTL text, HTML tags (e.g., "<script>") | Accepted as literal text (sanitized), or rejected | Medium | Dev to confirm sanitization strategy (NEEDS PO/DEV CONFIRMATION) |
| 9 | Creating a root module when project has no prior modules (empty tree) | Module appears as first item in previously empty sidebar | High | Test only — implied by AC1 but empty-state transition should be explicitly verified |
| 10 | Creating a module in a project that the user can read but whose workspace the user is only a viewer in | Rejected with 403; UI create button should be hidden or disabled | High | Add to AC — authorization boundary (NEEDS PO/DEV CONFIRMATION) |
| 11 | Concurrent creation of two modules with the same name under the same parent | Both succeed (if no uniqueness constraint) or one fails with a conflict | Medium | Dev to confirm uniqueness rules and concurrent-create behavior (NEEDS PO/DEV CONFIRMATION) |
| 12 | Creating a module with `parent_module_id` set to a module in a different project (cross-project parent) | Rejected — parent must belong to same project | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 13 | Depth exactly at the warning boundary: creating at level 5 (parent at level 4) | Module created + non-blocking warning shown | High | Covered by AC4 — included here to flag the boundary assertion explicitly |
| 14 | Depth at level 6 (parent at level 5) — last valid level with no block | Module created. Does a warning appear for level 6 as well, or only for level 5? | High | Ambiguous from ACs — AC4 says "beyond 4 levels" which could mean 5 AND 6 both warn (NEEDS PO/DEV CONFIRMATION) |
| 15 | `path` column value after creation: verify the materialized path matches the expected format | `path` = `/Payment/Refunds` for a module named "Refunds" under "Payment" | High | Integration test — path correctness is a data-integrity invariant |
| 16 | `position` value collision: two users create sibling modules simultaneously | Race condition — position values may collide; sort order becomes non-deterministic | Medium | Dev to document concurrent-safe position assignment (NEEDS PO/DEV CONFIRMATION) |
| 17 | Creating a module when the parent project does not belong to the caller's active workspace | Rejected by RLS (row not found) or explicit 404/403 | High | Test only — RLS behavior is expected but should be verified for this entity |

### Contradictions

**CRITICAL CONTRADICTION — Depth thresholds:**

- **Business Rules field** states: "Depth warning: Creating at depth 4 or deeper returns a soft, non-blocking warning"
- **AC4** states: "Given a chain of Modules already nested 4 levels deep / When I add a sub-module at the 5th level / Then the sub-module is created / And I see a non-blocking warning"
- **business-data-map.md §Flow 2** documents: "depth 5 → warn (non-blocking), depth 7 → reject (HTTP 422)"

The business rules + ACs agree: the warning fires when creating a module whose resulting depth is 5 (parent at level 4) or deeper, and the hard block fires at resulting depth 7 (parent at level 6). The data-map also agrees on the hard block trigger. However, the data-map says the WARN fires at depth 5 (consistent with ACs), but the business rule wording "depth 4 or deeper" could be read as warning at resulting depth 4 (parent at level 3). The ACs are the authoritative source and indicate warn at resulting depth = 5. The data-map confirms depth 7 block (HTTP 422, error code `MODULE_DEPTH_EXCEEDED`). **This must be confirmed with Dev to ensure implementation matches ACs, not an earlier draft spec.**

**Description field absent from all ACs**: Business rules list description as an optional field, but no AC tests it. Gap 4 above documents this.

### Testability validation

**Verdict**: Partial

Issues:
- **Vague depth warning trigger**: AC4 says "beyond 4 levels shows a soft warning" — the word "beyond" is ambiguous. Does the warning also fire at level 6 (last valid level)? AC does not say. Cannot write a deterministic test for level-6 without clarification.
- **No error message verbatim**: AC3 says "I see a message that the name must be at least 2 characters" but does not give the exact error message text. Cannot write an exact-match assertion. Same for AC5: "maximum nesting depth is 6 levels" — is this the literal message or a paraphrase?
- **No API contract defined**: Without knowing whether the feature is implemented as a REST endpoint or a Server Action, integration-level test strategy cannot be finalized.
- **Success feedback not specified**: ACs say "the Module appears at the top level of the tree" — is this immediate (optimistic UI update) or after a page refresh? Cannot write a timing-sensitive assertion without knowing the update mechanism.
- **Concurrent create behavior**: Position ordering under concurrent creates is untestable without knowing the assignment strategy.

---

## Phase 3 — Refined Acceptance Criteria

### Original AC1 — Create a top-level Module inside a Project

#### Scenario 1.1: Should create a root module and display it at the top level of the tree (Type: Positive, Priority: Critical)

- **Given**: A Senior QA Engineer is a `member` of a Workspace containing a Project "E-Commerce" with an empty Module tree
- **When**: The user triggers "New Module" at the Project root, enters name "Payment" (with no parent selected / parent = null), and submits
- **Then**:
  - UI: "Payment" node appears at the top level of the Module tree in the sidebar, with depth = 1
  - API: `POST /api/v1/modules` returns HTTP 201 with body `{ id: "<uuid>", name: "Payment", path: "/Payment", position: 1, parent_module_id: null, project_id: "<project_uuid>", depth: 1 }` (or equivalent Server Action response)
  - DB: `modules` table has one new row with `name = "Payment"`, `parent_module_id = null`, `path = "/Payment"`, `project_id = <project_uuid>`, `position = 1`
  - System state: The new module node is selectable as a parent in the "Add sub-module" trigger

#### Scenario 1.2: Should make a newly created root module immediately selectable as a parent (Type: Positive, Priority: High)

- **Given**: "Payment" root module was just created successfully
- **When**: The user triggers "Add sub-module" and opens the parent-selection UI
- **Then**: "Payment" appears as a selectable parent option without requiring a page reload
- **NEEDS PO/DEV CONFIRMATION**: the exact refresh mechanism (optimistic UI, Realtime subscription, or page reload) is not specified in the story

---

### Original AC2 — Create a nested sub-module under an existing Module

#### Scenario 2.1: Should create a sub-module nested under its parent with correct breadcrumb (Type: Positive, Priority: Critical)

- **Given**: Module "Payment" (depth 1) exists in the Project "E-Commerce"
- **When**: The user triggers "Add sub-module" under "Payment", enters name "Refunds", and submits
- **Then**:
  - UI: "Refunds" appears nested beneath "Payment" in the sidebar tree (depth = 2); breadcrumb displays "Payment / Refunds" (separator is " / " — space-slash-space — NEEDS PO/DEV CONFIRMATION on exact format)
  - API: `POST /api/v1/modules` returns HTTP 201 with `{ name: "Refunds", path: "/Payment/Refunds", parent_module_id: "<payment_uuid>", depth: 2 }`
  - DB: `modules` row has `name = "Refunds"`, `parent_module_id = <payment_uuid>`, `path = "/Payment/Refunds"`, `depth = 2`
  - System state: "Refunds" is selectable as a parent for further sub-modules

#### Scenario 2.2: Should correctly compute path for a deeply nested module (Type: Positive, Priority: High)

- **Given**: Module chain "Payment" → "Refunds" → "International" exists (depth 3)
- **When**: The user adds sub-module "EU-Zone" under "International"
- **Then**:
  - DB: `path = "/Payment/Refunds/International/EU-Zone"`, `depth = 4`
  - UI: Breadcrumb reads "Payment / Refunds / International / EU-Zone" (NEEDS PO/DEV CONFIRMATION on display format)

---

### Original AC3 — Module name shorter than minimum is rejected

#### Scenario 3.1: Should reject a single-character module name with a validation error (Type: Negative, Priority: Critical)

- **Given**: The user has the "New Module" form open
- **When**: The user enters name "P" (1 character) and submits
- **Then**:
  - UI: Module is NOT created; inline validation message appears: "name must be at least 2 characters" (exact text NEEDS PO/DEV CONFIRMATION)
  - API: `POST /api/v1/modules` returns HTTP 422 with body `{ error: { code: "VALIDATION_ERROR", message: "Module name must be at least 2 characters" } }` (error code and exact message text NEEDS PO/DEV CONFIRMATION)
  - DB: No new row in `modules` table

#### Scenario 3.2: Should reject an empty module name (Type: Negative, Priority: High)

- **Given**: The user has the "New Module" form open
- **When**: The user submits with an empty name field
- **Then**:
  - UI: Module is NOT created; validation message indicates name is required
  - API: HTTP 422 or 400 (NEEDS PO/DEV CONFIRMATION — required-field vs. length-validation error code may differ)
  - DB: No new row in `modules` table

#### Scenario 3.3: Should accept a module name of exactly 2 characters (boundary — minimum) (Type: Boundary, Priority: High)

- **Given**: The user has the "New Module" form open
- **When**: The user enters name "AB" (exactly 2 characters) and submits
- **Then**: Module is created successfully with `name = "AB"`
- **NEEDS PO/DEV CONFIRMATION**: minimum boundary exact acceptance is inferred from the 2-char rule

---

### Original AC4 — Nesting beyond 4 levels shows a soft warning but is allowed

#### Scenario 4.1: Should show a non-blocking warning when creating at depth 5 (parent at depth 4) (Type: Positive, Priority: High)

- **Given**: A chain of 4 nested modules exists: L1 → L2 → L3 → L4 (L4 is at depth 4)
- **When**: The user adds sub-module "Level-5" under L4
- **Then**:
  - UI: Module "Level-5" IS created and appears in the tree at depth 5; a non-blocking warning toast or inline notice appears (e.g., "This tree is getting deep — consider a flatter structure"); user can dismiss it
  - API: HTTP 201 (success) with warning metadata (e.g., `{ warning: "DEPTH_WARNING", depth: 5 }`) — NEEDS PO/DEV CONFIRMATION on whether warning is in response body or UI-only
  - DB: Module created with `depth = 5`; no DB-level error

#### Scenario 4.2: Should show a warning when creating at depth 6 (last valid level) (Type: Positive, Priority: Medium)

- **Given**: A chain of 5 nested modules exists (L5 at depth 5)
- **When**: The user adds sub-module "Level-6" under L5
- **Then**: Module IS created (depth 6 is within the 6-level max); warning IS shown (NEEDS PO/DEV CONFIRMATION — story says warning fires "beyond 4 levels", which includes depth 6)
  - DB: Module created with `depth = 6`

---

### Original AC5 — Nesting beyond maximum depth is blocked

#### Scenario 5.1: Should block creation at depth 7 with a clear error (Type: Negative, Priority: Critical)

- **Given**: A chain of 6 nested modules exists: L1 through L6 (L6 at depth 6, the maximum)
- **When**: The user attempts to add a sub-module under L6
- **Then**:
  - UI: Module is NOT created; blocking error message appears: "the maximum nesting depth is 6 levels" (exact text NEEDS PO/DEV CONFIRMATION)
  - API: `POST /api/v1/modules` returns HTTP 422 with `{ error: { code: "MODULE_DEPTH_EXCEEDED", message: "Maximum nesting depth of 6 levels exceeded" } }` (error code from epic technical context)
  - DB: No new row inserted
  - System state: L6 is NOT selectable as parent, or the submit action is disabled in UI

---

### New scenarios surfaced from Phase 2 edge cases — NEEDS PO/DEV CONFIRMATION

#### Scenario E1: Should accept a module name of exactly 80 characters (upper boundary) (Type: Boundary, Priority: High)

- **NEEDS PO/DEV CONFIRMATION**: 80-char maximum is from business rules; no AC covers this boundary
- **Given**: The user has the "New Module" form open
- **When**: The user enters a name of exactly 80 characters and submits
- **Then**: Module is created successfully

#### Scenario E2: Should reject a module name of 81 characters (one over maximum) (Type: Boundary, Priority: High)

- **NEEDS PO/DEV CONFIRMATION**: Exact error message text not specified in story
- **Given**: The user has the "New Module" form open
- **When**: The user enters a name of 81 characters and submits
- **Then**: Module is NOT created; validation message "name must be at most 80 characters" appears (exact text NEEDS PO/DEV CONFIRMATION)

#### Scenario E3: Should reject a module name consisting only of whitespace (Type: Negative, Priority: High)

- **NEEDS PO/DEV CONFIRMATION**: Whitespace-only name behavior is not specified
- **Given**: The user has the "New Module" form open
- **When**: The user enters "   " (3 spaces) and submits
- **Then**: Module is NOT created; treated as empty/invalid input

#### Scenario E4: Should reject creation when the caller is a viewer-role workspace member (Type: Negative, Priority: High)

- **NEEDS PO/DEV CONFIRMATION**: Role gate for module creation is not stated in this story (inferred from business-data-map.md §7: member+ for CRUD)
- **Given**: A user with `viewer` role in the Workspace is on the Project page
- **When**: The user attempts to create a module (via API or UI)
- **Then**: Creation is rejected with HTTP 403; UI create button is disabled or hidden for viewers

#### Scenario E5: Should reject a parent module that belongs to a different project (Type: Negative, Priority: High)

- **NEEDS PO/DEV CONFIRMATION**: Cross-project parent rejection is inferred from business rule "A Module belongs to exactly one Project"
- **Given**: Projects A and B exist; Module "Alpha" belongs to Project A
- **When**: The user attempts to create a module in Project B with `parent_module_id` pointing to "Alpha" (from Project A)
- **Then**: Creation is rejected with an appropriate error (HTTP 400 or 422); DB shows no new row

#### Scenario E6: Should correctly set `position` for a new module appended as the last sibling (Type: Positive, Priority: Medium)

- **NEEDS PO/DEV CONFIRMATION**: Position assignment strategy (append vs. user-specified) is not documented in story
- **Given**: Project root already contains modules at positions 1 and 2
- **When**: A new root module is created
- **Then**: New module receives `position = 3` (appended last); sidebar displays it after the existing root modules

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate

| Type | Count | Notes |
|------|-------|-------|
| Positive | 6 | Root create, nested create, depth-5 warn, depth-6 warn, description field, empty-tree first module |
| Negative | 8 | 1-char name, empty name, whitespace-only, 81-char name, depth-7 block, viewer unauthorized, cross-project parent, unauthenticated |
| Boundary | 4 | Min name (2 chars), max name (80 chars), depth 5 (first warn), depth 6 (last valid) |
| Integration | 4 | RLS cross-workspace isolation, path materialization correctness, position ordering, Realtime tree refresh |
| API | 3 | POST /api/v1/modules happy path, POST with invalid payload (400/422), POST without auth (401) |
| **Total** | **25** | **(drives PO estimation)** |

**Rationale**: The depth state machine alone accounts for 4 test variants (normal / warn-at-5 / warn-at-6 / block-at-7). The self-referential tree structure requires integration tests that set up a precondition chain of 4–6 modules before the assertion, making setup cost high. The combination of two validation axes (name length AND depth) with a tree integrity constraint (parent in same project) justifies a higher count than a typical CRUD story.

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive

- **Should create a root module in an empty project tree** — Pre: authenticated member, project with no modules. Expected: HTTP 201, module appears at sidebar depth-1, `path = "/{name}"`.
- **Should create a root module when the project already has sibling modules** — Pre: project with 2 existing root modules. Expected: new module appears with `position = 3`, does not displace existing siblings.
- **Should create a sub-module nested one level under an existing module** — Pre: root module "Payment" exists. Expected: HTTP 201, breadcrumb "Payment / {name}", `depth = 2`.
- **Should create a sub-module at depth 5 with a non-blocking warning** — Pre: 4-level module chain exists. Expected: HTTP 201, warning response or toast, module created at depth 5.
- **Should create a sub-module at depth 6 (last valid level) with a non-blocking warning** — Pre: 5-level chain exists. Expected: HTTP 201, warning shown, module created at depth 6.
- **Should create a module with an optional description in Markdown** — Pre: authenticated member, project exists. Expected: module created with `description` field stored as-is (Markdown text). (NEEDS PO/DEV CONFIRMATION on description behavior)

#### Negative

- **Should reject module creation when name is 1 character long** — Pre: "New Module" form open. Expected: HTTP 422, message "at least 2 characters", no DB row.
- **Should reject module creation when name field is empty** — Pre: "New Module" form open. Expected: HTTP 400 or 422, required-field error, no DB row.
- **Should reject module creation when name contains only whitespace** — Pre: "New Module" form open. Expected: HTTP 422, treated as empty, no DB row. (NEEDS PO/DEV CONFIRMATION)
- **Should reject module creation when name is 81 characters** — Pre: "New Module" form open. Expected: HTTP 422, "at most 80 characters" error, no DB row.
- **Should reject sub-module creation when it would exceed depth 6** — Pre: 6-level module chain exists. Expected: HTTP 422, `MODULE_DEPTH_EXCEEDED`, no DB row.
- **Should reject module creation when caller is a viewer-role workspace member** — Pre: viewer-role user, project exists. Expected: HTTP 403, no DB row, UI button disabled. (NEEDS PO/DEV CONFIRMATION)
- **Should reject module creation when `parent_module_id` belongs to a different project** — Pre: two projects, parent from Project A. Expected: HTTP 400/422, ownership error, no DB row. (NEEDS PO/DEV CONFIRMATION)
- **Should reject unauthenticated module creation** — Pre: no auth token, valid project. Expected: HTTP 401, no DB row.

#### Boundary

- **Should accept a module name of exactly 2 characters (minimum boundary)** — Pre: "New Module" form open. Expected: HTTP 201, module created with 2-char name.
- **Should accept a module name of exactly 80 characters (maximum boundary)** — Pre: "New Module" form open. Expected: HTTP 201, module created with 80-char name. (NEEDS PO/DEV CONFIRMATION)
- **Should create at depth 5 (first soft-warn depth) and confirm module IS created** — Pre: 4-level chain. Expected: module exists in DB at depth 5, warning shown.
- **Should create at depth 6 (last valid depth before hard block)** — Pre: 5-level chain. Expected: module exists in DB at depth 6, warning shown (NEEDS PO/DEV CONFIRMATION on warning at depth 6).

#### Integration

- **Should verify `path` column is correctly materialized on root module creation** — Pre: project with no modules. Expected: DB `path = "/{module_name}"`.
- **Should verify `path` column is correctly materialized for a 3-level nested module** — Pre: 2-level chain. Expected: DB `path = "/{L1}/{L2}/{L3}"`.
- **Should verify RLS prevents cross-workspace module creation** — Pre: two workspaces, user in WS-A. Expected: cannot create or read modules in WS-B; WS-B modules not returned in tree.
- **Should verify Supabase Realtime refreshes the sidebar tree after module creation** — Pre: two browser sessions on same project. Expected: creating a module in session 1 causes tree update in session 2 without manual reload. (NEEDS PO/DEV CONFIRMATION on Realtime behavior)

#### API

- **Should return HTTP 201 with complete module payload on successful POST /api/v1/modules** — Pre: authenticated member, valid body. Expected: response includes `id`, `name`, `path`, `position`, `depth`, `parent_module_id`, `project_id`.
- **Should return HTTP 422 with `VALIDATION_ERROR` code on POST with invalid name** — Pre: authenticated member, name = "P". Expected: structured error envelope `{ error: { code: "VALIDATION_ERROR", message: "..." } }`.
- **Should return HTTP 401 on POST /api/v1/modules without Authorization header** — Pre: no auth. Expected: 401 response, no module created.

> **NOT included here** (deferred to in-sprint planning by `/sprint-testing` Stage 1): parametrization tables, per-outline test-data JSON, numbered test steps, Faker generation strategies. Coverage estimate IS included because PO uses it for estimation.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|-----------|-------------------|-------------|--------|
| 1 | Module name = exactly 2 chars (min boundary) | No (AC3 only tests 1-char rejection) | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 2 | Module name = exactly 80 chars (max boundary) | No | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 3 | Module name = 81 chars (over max) | No | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 4 | Module name is whitespace-only | No | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 5 | Module name has leading/trailing whitespace | No | Medium | Ask PO — trim vs. reject behavior |
| 6 | Duplicate module name within same parent (sibling) | No | Medium | Ask PO — uniqueness not stated (NEEDS PO/DEV CONFIRMATION) |
| 7 | Cross-project `parent_module_id` | No | High | Add to AC (NEEDS PO/DEV CONFIRMATION) |
| 8 | Viewer-role user attempting module creation | No | High | Add to AC — auth boundary (NEEDS PO/DEV CONFIRMATION) |
| 9 | Module creation in project not in caller's workspace | No | High | Test only — RLS should reject, verify behavior |
| 10 | Depth 6 creation — does warning fire at this level? | No (AC4 only specifies depth 5) | High | Ask PO (NEEDS PO/DEV CONFIRMATION) |
| 11 | Concurrent sibling creates — position collision | No | Medium | Dev to document (NEEDS PO/DEV CONFIRMATION) |
| 12 | `path` value correctness after deeply nested create (4 levels) | Implicit in AC2 — only tests 1 nesting | High | Integration test — path is a data-integrity invariant |
| 13 | Module name containing special characters (emoji, HTML, RTL) | No | Medium | Dev to confirm sanitization (NEEDS PO/DEV CONFIRMATION) |
| 14 | Creating first module in a project with an empty tree (empty-state transition) | Partially covered by AC1 ("empty Module tree") | Medium | Test only — sidebar empty-state should be replaced by first module node |
| 15 | Double-submit (network retry / rapid clicks) producing duplicate modules | No | Medium | Ask Dev — idempotency strategy (NEEDS PO/DEV CONFIRMATION) |
| 16 | Supabase Realtime broadcast: does a new module appear in a second open browser tab? | No | Medium | Integration/E2E test — Realtime is expected behavior per epic but not stated in story |

> Test-data generation strategy + Faker recipes are NOT defined here. They land in `/sprint-testing` Stage 1 when the feature exists.

---

## Story Quality Assessment

**Verdict**: Needs Improvement

**Key findings**:
- The five ACs cover the primary happy paths and the two validation rejection paths well, but leave significant gaps in authorization (no role-gate AC), name boundary testing (no 80-char max AC), and API contract details (no error message verbatim, no HTTP status codes specified)
- A critical contradiction exists between the Business Rules field ("depth 4 or deeper") and the data-map ("depth 5 warn"), though the ACs themselves are internally consistent — the contradiction needs resolution before implementation begins to prevent the Dev building against a different threshold than QA will test
- The implementation pattern (REST endpoint vs. Server Action) is completely unspecified, which makes integration-level test strategy indeterminate; this is the single most important technical gap

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. ✅ **ANSWERED — What is the exact warning trigger depth?**
   - **Context**: Business Rules says "Creating at depth 4 or deeper returns a soft warning." Ambiguity between "parent depth 4" vs "resulting depth 4".
   - **PO Answer (2026-06-02)**: Warning fires when attempting to create level 5, i.e., when 4 levels already exist. Confirmed: warning triggers when resulting depth = 5 or 6 (parent at depth 4 or 5). No warning for depths 1–4.
   - **Impact on tests**: Depth-5 and depth-6 creation scenarios must both assert the warning appears. Depth-4 creation must assert NO warning.

2. ✅ **ANSWERED — Does the warning also appear when creating at depth 6 (the last valid level)?**
   - **PO Answer (2026-06-02)**: Yes — warning fires at both depth 5 and depth 6 (implied by Q1 answer: "parent at depth 4 or 5").
   - **Impact on tests**: Two boundary scenarios required: warn-at-5 AND warn-at-6.

3. ✅ **ANSWERED — Description field: character limit and Markdown rendering location?**
   - **PO Answer (2026-06-02)**: Max 500 characters. Renders as Markdown in the tree view, below the module name — truncated to 3 lines with a "more" expand option for longer content.
   - **Impact on tests**:
     - Add boundary AC: description of 500 chars accepted; 501 chars rejected.
     - Add positive AC: Markdown renders in tree view (e.g., `**bold**` renders as `<strong>bold</strong>`).
     - Add UI AC: descriptions > 3 lines show truncated view with "more" expand; full Markdown visible after expand.
     - Negative: description of 501 chars rejected with validation message.

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **Will module creation be implemented as a REST endpoint (`POST /api/v1/modules`) or as a Supabase RPC / Next.js Server Action?** — The existing module-related operations in the codebase use direct Supabase client reads (no REST for read). ATC save uses an RPC Server Action. Which pattern will BK-9 follow? Testing strategy (curl-based API test vs. browser-only E2E) depends entirely on this answer.

2. ✅ **ANSWERED — Where is depth computed?** — **PO Answer (2026-06-02)**: Both layers. App layer enforces first (to avoid the DB round-trip cost on valid creates). DB layer enforces second (trigger/constraint) as a safety net for direct DB inserts or API calls that bypass the handler. Error code `MODULE_DEPTH_EXCEEDED` must be thrown at the app layer; DB constraint is a hard guard.

3. **What is the position assignment strategy for new modules?** — Append (last sibling + 1)? User-specified? What happens under concurrent inserts (two users create siblings simultaneously)? A `SELECT MAX(position) + 1` pattern is not safe under concurrent load without a lock or a sequence.

4. **Does `POST /api/v1/modules` (if that is the chosen pattern) support the `Idempotency-Key` header?** — business-api-map.md notes `lib/api/idempotency.ts` is implemented but not wired to any endpoint. For module creation, a network-retry double-submit could create duplicate root modules.

5. **Does module creation write to `activity_log`?** — All other entity-creating RPCs write to `activity_log`. If modules do not, the audit trail is incomplete. Confirm before QA writes audit-log assertions.

6. **Does Supabase Realtime broadcast on module INSERT?** — ATC creation broadcasts via Realtime. Does the `modules` table have a Realtime subscription in the sidebar? This determines whether E2E multi-tab tests for live-tree-refresh are required.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | No AC for 80-character maximum name | Add AC: "When I submit a module name of 81 characters, the module is not created and I see a message that the name must be at most 80 characters" | Closes the upper boundary gap; explicit test target for the name-length validation |
| 2 | No AC for viewer-role authorization | Add AC: "Given I am a viewer-role member, when I attempt to create a module, then the creation is rejected and the create action is unavailable in the UI" | Closes the authorization gap; ensures privilege boundary is tested before sprint |
| 3 | Paraphrased error messages in ACs | Replace paraphrases with literal UI copy: `"Module name must be at least 2 characters."` and `"Maximum nesting depth of 6 has been reached."` | Enables exact-match assertion; prevents tests passing on wrong-but-similar error text |
| 4 | No AC or guidance on the description field | ✅ RESOLVED BY PO (2026-06-02): Add AC — "Description is optional, up to 500 characters, stored as Markdown. Renders in tree view below module name — truncated to 3 lines with 'more' expand. 501+ chars rejected with validation error." | Confirmed in scope for BK-9; description rendering IS part of this story |
| 5 | "selectable as a parent for new sub-modules" (AC1) — UI mechanism unspecified | Add: "The parent list refreshes immediately after creation without requiring a page reload (via Supabase Realtime subscription)" | Makes the real-time refresh testable and surfaced as a requirement |

---

## Data feasibility flags

No data feasibility risks identified.

The `modules` table is live in the DB (`✅ Implemented` per business-data-map.md §1 and §9). All relevant fields (`name`, `parent_module_id`, `path`, `position`, `project_id`, `created_at`) are confirmed present in the live schema. The test data dependency chain (workspace → project → module) is well-understood and all prerequisite entities are in the live DB. No pre-work is needed at the data layer before testing can begin once the feature is implemented.

---

## Recommended testing strategy

### Pre-implementation

- Confirm answers to the 3 Critical PO Questions and 6 Technical Dev Questions above before sprint begins
- Lock the exact error message strings for AC3 and AC5 so QA can write exact-match assertions
- Confirm implementation pattern (REST vs. Server Action) so test scaffolding can be designed

### During implementation

- Unit tests: path computation (`"/{L1}/{L2}"` pattern), depth counting (recursive CTE or ancestor traversal), name validation (min 2 / max 80), whitespace handling
- API contract test: verify `POST /api/v1/modules` response envelope matches `{ id, name, path, position, depth, parent_module_id, project_id }` on 201; verify `MODULE_DEPTH_EXCEEDED` error code on 422 for depth 7
- DB assertion: verify `modules` row has correct `path`, `depth`, `position`, `parent_module_id` values after create; verify no orphan rows on failed creation

### Post-implementation (in-sprint by /sprint-testing)

- E2E Playwright: full user journey (create Project → create root Module → create sub-module → verify sidebar tree, breadcrumb, depth warning toast)
- Integration: RLS cross-workspace isolation — user from WS-A cannot see or create modules in WS-B
- Integration: concurrent sibling creates — verify position ordering is deterministic under concurrent inserts
- Integration: Supabase Realtime — module create in one tab refreshes tree in second tab
- Regression: verify existing sidebar read (`buildModuleTree()`) still works correctly after new modules are inserted

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|------------------------------|
| 1 | Depth threshold implemented at wrong level (fires at depth 4 instead of 5) | Medium — spec ambiguity exists | High — QA tests the wrong boundary, defect ships | Outline: "Should create at depth 5 (first soft-warn depth)" + "Should create at depth 6 (last valid depth)" |
| 2 | `path` column not correctly materialized (stale or incorrect after nested create) | Medium — computed columns are tricky to get right on first pass | High — breadcrumbs wrong across the app; downstream BK-10/11 depend on correct path | Integration outlines: "Should verify path for 3-level nested module" |
| 3 | Module creation not RLS-scoped: cross-workspace module visible or creatable | Low — RLS pattern is established in workspace/project | Critical — data breach | Integration outline: "Should verify RLS prevents cross-workspace module creation" |
| 4 | Position collision under concurrent creates: two sibling modules get same position | Low — concurrent create is rare in MVP | Medium — tree sort non-deterministic | Integration outline: concurrent position collision (Dev to document strategy first — NEEDS PO/DEV CONFIRMATION) |
| 5 | Server Action / REST pattern mismatch with existing test infrastructure | Medium — choice not yet made | Medium — test scaffolding may need to be rebuilt mid-sprint | Technical Question #1 to Dev — unblock before sprint starts |
| 6 | Supabase Realtime not configured for `modules` table, tree does not refresh | Medium — ATC uses Realtime but modules may not have subscription yet | Medium — UX broken; user must reload to see new modules | Integration outline: Realtime sidebar refresh |

---

## Next steps

- [x] PO answered Critical Questions 1, 2, 3 on 2026-06-02
  - Warning fires at resulting depth 5 and 6 (parent at depth 4+)
  - Depth enforcement: app layer + DB constraint (dual)
  - Description: max 500 chars, Markdown renders in tree (3-line truncate + "more" expand)
- [ ] Dev answers remaining Technical Questions before estimation (Q1: implementation pattern, Q3: position strategy, Q4: idempotency, Q5: activity_log, Q6: Realtime)
- [ ] Add 3 new ACs to Jira before sprint planning: description boundaries, description Markdown render, depth-6 warning
- [ ] Confirm exact error message strings (AC3 min-name + AC5 depth-exceeded) — still open
- [ ] Story receives 2 new ACs: 80-char max name rejection + viewer-role authorization
- [ ] Story error message strings are made literal (not paraphrased) in ACs
- [ ] Story enters sprint at status `Ready for Dev` once estimated
- [ ] When Story reaches `Ready for QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected)
