# ATC Spec: BK-545 — allowSessionAuthenticatedTokenLifecycle

> Ticket: BK-497
> Component: TokensApi (tests/components/api/TokensApi.ts) — NEW component
> Type: API — Mutation, multi-action embedded-verification (P0 positive control)
> Parent Story: BK-497

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| allowSessionAuthenticatedTokenLifecycle | Verify session-cookie auth is entirely unaffected by the `cookie-only` lift across all 3 token routes in sequence | Caller has an active session (cookie-authenticated, Bearer cleared) | POST → 201, GET → 200, DELETE → 204, all in the same request context |

## 2. ATC Contract

```typescript
/**
 * ATC: session-cookie issue -> list -> revoke chain on /api/v1/tokens*.
 * Fixed assertions:
 *  - issue: 201, token.id defined
 *  - list: 200, tokens array contains the issued id
 *  - revoke: 204
 * Embeds 3 @step helper calls (issueToken, listTokens, revokeToken) — NOT other @atc
 * methods, so this does not violate the ATC-calls-ATC rule.
 */
@atc('BK-545')
async allowSessionAuthenticatedTokenLifecycle(
  body: CreateTokenBody,
): Promise<[APIResponse, APIResponse, APIResponse]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoints | `POST /api/v1/tokens` → `GET /api/v1/tokens` → `DELETE /api/v1/tokens/{id}`, in sequence |
| Request body (POST) | `CreateTokenBody` — `{ name, scopes }`, caller-supplied (test varies `name` via `this.data.createTestId`) |
| Auth | `this.authToken` must be `null` (cleared) for the ENTIRE chain — cookie-only, established by the test precondition (`api.auth.authenticateSuccessfully()` then `tokens.clearAuthToken()`) BEFORE this ATC runs |

## 4. Assertions Split

### Fixed (inside ATC)
- `issueResponse.status() === 201`, `issueBody.id` defined
- `listResponse.status() === 200`, `listBody.tokens` contains an entry with `id === issueBody.id`
- `revokeResponse.status() === 204`

### Test-level (in test file)
- None required beyond the ATC's own embedded chain — the TC's identity IS the full chain
  (single Jira Test issue, single Gherkin scenario with 3 `When/Then` pairs); splitting further
  would fragment one TMS-approved TC into 3 ATCs it was never designed as.

## 5. Code Template

```typescript
@atc('BK-545')
async allowSessionAuthenticatedTokenLifecycle(
  body: CreateTokenBody,
): Promise<[APIResponse, APIResponse, APIResponse]> {
  // Precondition contract: this.authToken must already be null (cookie-only) — enforced by
  // the calling test, not by this ATC (per "preconditions received via parameters" rule).

  // ACTION 1: issue
  const [issueResponse, issueBody] = await this.issueToken(body);
  expect(issueResponse.status()).toBe(201);
  expect(issueBody.id).toBeDefined();

  // ACTION 2: list (VERIFICATION that the issued token appears)
  const [listResponse, listBody] = await this.listTokens();
  expect(listResponse.status()).toBe(200);
  expect(listBody.tokens.some(t => t.id === issueBody.id)).toBe(true);

  // ACTION 3: revoke
  const [revokeResponse] = await this.revokeToken(issueBody.id);
  expect(revokeResponse.status()).toBe(204);

  return [issueResponse, listResponse, revokeResponse];
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|----|-----------------|----------------|
| AC-04/05/06 non-regression (session traffic unaffected) | EP (always) | 1 — single TMS-designed chain, not decomposable into partitions (see §4 rationale) |

## 7. Dependencies

- Precondition: `AuthApi.authenticateSuccessfully()` (fresh session), then `tokens.clearAuthToken()`.
- Required Components: `TokensApi` — new. Reuses `issueToken`, `listTokens`, `revokeToken`
  `@step` helpers shared with BK-552/553/543 (DRY — same 3 underlying HTTP wrappers, different
  auth channel per caller).

## 8. Data Context

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Active session (cookie only) | Generate | `api.auth.authenticateSuccessfully()` + `tokens.clearAuthToken()` | `beforeEach` | None |

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `allowSessionAuthenticatedTokenLifecycle`
- [x] Max 2 positional params — 1 (`body`)
- [x] Correct return type — deliberate 3-tuple of `APIResponse` (documented deviation from the
      standard POST tuple, justified by the TC's own multi-action design)
- [x] Fixed vs test-level assertions split (§4)
- [x] Not duplicating an existing ATC
