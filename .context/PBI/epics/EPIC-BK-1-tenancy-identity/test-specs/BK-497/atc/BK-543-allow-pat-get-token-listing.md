# ATC Spec: BK-543 — allowPatGetTokenListing

> Ticket: BK-497
> Component: TokensApi (tests/components/api/TokensApi.ts) — NEW component
> Type: API — Verification (positive control)
> Parent Story: BK-497

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| allowPatGetTokenListing | Verify `GET /api/v1/tokens` still accepts Bearer PAT auth (NOT swept into the `cookie-only` lift) | Caller holds any valid minted PAT | Response 200, body lists the caller's tokens |

## 2. ATC Contract

```typescript
/**
 * ATC: GET /api/v1/tokens using a PAT (Bearer) as auth.
 * Fixed assertions:
 *  - 200 OK
 *  - body.tokens is an array
 */
@atc('BK-543')
async allowPatGetTokenListing(): Promise<[APIResponse, ListTokensResponse]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `GET /api/v1/tokens` |
| Response | 200 `ListTokensResponse` — `{ tokens: TokenSummary[] }`, RLS-scoped to the caller |
| Auth | `this.authToken` ambient — set to the acting PAT by the test precondition before the call |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 200`
- `Array.isArray(body.tokens)`

### Test-level (in test file)
- None required — this is a single-call positive control per the TC's own scope ("proves GET
  was NOT swept into the cookie-only lift"); no cross-endpoint composition needed.

## 5. Code Template

```typescript
@atc('BK-543')
async allowPatGetTokenListing(): Promise<[APIResponse, ListTokensResponse]> {
  const [response, body] = await this.apiGET<ListTokensResponse>('/api/v1/tokens');

  expect(response.status()).toBe(200);
  expect(Array.isArray(body.tokens)).toBe(true);

  return [response, body];
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|----|-----------------|----------------|
| AC-04/05 non-regression (GET exception) | EP (always) | 1 — "any valid PAT" partition, scope-irrelevant per TC text |

## 7. Dependencies

- Precondition: `AuthApi.authenticateSuccessfully()`; `TokensApi.mintPatWithScopes()`.
- Required Components: `TokensApi` — new. Reused verbatim (`listTokens` helper) by BK-552/553's
  test-level verification and by BK-545's embedded list step — this ATC is effectively the
  `@atc`-decorated wrapper around the same underlying `listTokens()` `@step` helper, with its
  own fixed assertions (the helper itself carries none, per the Helper-vs-ATC split rule).

## 8. Data Context

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Any valid PAT | Generate | `tokens.mintPatWithScopes({ scopes: ['atc:read'] })` | `beforeEach` | None |

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `allowPatGetTokenListing`
- [x] Max 2 positional params — 0
- [x] Correct return type — tuple `[APIResponse, TBody]` for a GET
- [x] Fixed vs test-level assertions split (§4)
- [x] Not duplicating an existing ATC
