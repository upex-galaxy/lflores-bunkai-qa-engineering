# ATC Spec: BK-477 — assignBugToEligibleMember

> Ticket: BK-477 (TC1, TMS test case for Story BK-264)
> Component: BugsApi (tests/components/api/BugsApi.ts) — NEW component
> Type: API — Mutation, Happy path
> Parent Story: BK-264

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| assignBugToEligibleMember | Assign an open, unassigned bug to an eligible workspace member (role member or owner) | Bug open + unassigned; target is active member/owner | AC1 (BK-264) |

## 2. ATC Contract

```typescript
/**
 * ATC: Assign an open bug to an eligible workspace member — expects success (200)
 * Fixed assertions:
 *  - response.status() === 200
 *  - body.bug.assignee_user_id === payload.assignee_user_id
 */
@atc('BK-477')
async assignBugToEligibleMember(
  bugId: string,
  payload: BugAssignBody,
): Promise<[APIResponse, { bug: BugDetail }, BugAssignBody]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `POST /api/v1/bugs/{id}/assign` |
| OpenAPI Type(s) | `BugAssignBody`, `BugDetail` from `@schemas/bugs.types` |
| Auth Required | Yes — Bearer `atc:write` or cookie session; caller needs Member+ write access |
| Return Pattern | Tuple: `[APIResponse, { bug: BugDetail }, BugAssignBody]` |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 200`
- `body.bug.assignee_user_id === payload.assignee_user_id`
- `body.bug.id === bugId` (sanity — response echoes the right bug)

### Test-level (in test file)
- Subsequent read (via a `getBugById` helper, once it exists, or the list endpoint) reflects the same assignee — composes 2 endpoints, so it's test-level per KATA Rule 6.

## 5. Code Template

```typescript
import type { APIResponse } from '@playwright/test';
import type { BugAssignBody, BugDetail, BugStandaloneCreateBody } from '@schemas/bugs.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

export class BugsApi extends ApiBase {
  constructor(options: TestContextOptions) { super(options); }

  // Helper — Generate a fresh bug for a test's own precondition
  @step
  async fileBugSuccessfully(
    payload: BugStandaloneCreateBody,
  ): Promise<[APIResponse, { bug: BugDetail }, BugStandaloneCreateBody]> {
    return this.apiPOST<{ bug: BugDetail }, BugStandaloneCreateBody>('/bugs', payload);
  }

  @atc('BK-477')
  async assignBugToEligibleMember(
    bugId: string,
    payload: BugAssignBody,
  ): Promise<[APIResponse, { bug: BugDetail }, BugAssignBody]> {
    const [response, body, sentPayload] = await this.apiPOST<{ bug: BugDetail }, BugAssignBody>(
      `/bugs/${bugId}/assign`,
      payload,
    );
    expect(response.status()).toBe(200);
    expect(body.bug.assignee_user_id).toBe(payload.assignee_user_id);
    expect(body.bug.id).toBe(bugId);
    return [response, body, sentPayload];
  }
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|----|------------------|-----------------|
| AC1 (assign to eligible member) | EP (always) — 2 eligible roles (member, owner) share the same 200 outcome shape | 1 parameterized `@atc('BK-477')`, 2 Examples rows |

**Equivalence Partitioning detail:**

| Input (`assignee_user_id`'s role) | Expected output | Same ATC? |
|---|---|---|
| `member` | 200, assignee set | Yes — same behavior shape |
| `owner` | 200, assignee set | Yes — same behavior shape (merged into the same parameterized ATC) |
| non-member (outside workspace) | 422 | No — separate ATC (BK-480 / TC2, different partition) |
| viewer-role member | 422 | No — separate ATC (BK-481 / TC3, different partition) |

**Boundary Value Analysis detail**: N/A — `assignee_user_id` is a UUID reference, not a range/limit/length/date-window.

**Two reduction axes**: only EP fires here (no 2+ interacting conditions to warrant a Decision Table, no 3+ factors for Pairwise) — 1 parameterized ATC, 2 data rows, no further reduction needed.

| Parameterized ATC | Reduction applied | Rows after reduction |
|---|---|---|
| `assignBugToEligibleMember` | none (EP only) | 2 (member, owner) |

## 7. Dependencies

- Precondition Steps: none yet (no Steps module needed — this is a single-ATC precondition, inline in the test file per KATA Rule 5 "one-off precondition for one test").
- Required Components: `BugsApi` — new component, this is its first ATC. `fileBugSuccessfully` helper (Generate pattern) needed as a precondition to create a fresh open+unassigned bug per test run.

## 8. Data Context

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Workspace with active owner + active member | **Discover** | `BK-264 QA Sandbox` workspace (`6646f244-a28c-441e-8486-9af33bdb5c11`), seeded in a prior `/sprint-testing` session — confirmed still live via direct DB query this session (owner `2742da39-...`, member `c6a2b665-...`) | `beforeAll` (query via DB or hardcode the discovered ids as env-independent constants — see Risk below) | None — the workspace/members are stable, reused across runs |
| Project + module | **Discover** | Same workspace: project `BK264 Defect Triage` (`2fee236f-...`), module `Defect Triage Module` (`175f8a08-...`) — confirmed still live | `beforeAll` | None |
| Open, unassigned bug | **Generate** | `POST /api/v1/bugs` (standalone) with the discovered `project_id`/`module_id`, faker-generated title | Test-level (`beforeEach` or inline at test start) — one fresh bug per test run | None needed — bug stays assigned after the test, doesn't collide with future runs (each run creates a new one) |

**Risk (flag for the Code phase / Review)**: the Discover-tier workspace/project/module ids are currently hardcoded as constants (this session's regression-driven scope doesn't build a reusable "discover or generate a bugs-capable workspace" Steps module — that's a larger, module-driven concern for the remaining 12 TCs' session). If that workspace is ever deleted in staging, this ATC breaks. Acceptable for a first single-ATC pass; flag as a follow-up when the other 12 TCs are automated (likely warrants a `BugsSteps` module with a `discoverOrGenerateBugsWorkspace()` helper).

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `assignBugToEligibleMember`
- [x] Max 2 positional params — `(bugId, payload)`
- [x] Correct return type — tuple `[APIResponse, {bug: BugDetail}, BugAssignBody]`
- [x] Fixed vs test-level assertions split
- [x] Not duplicating an existing ATC — `kata-manifest.json` confirmed no `BugsApi` component exists yet
