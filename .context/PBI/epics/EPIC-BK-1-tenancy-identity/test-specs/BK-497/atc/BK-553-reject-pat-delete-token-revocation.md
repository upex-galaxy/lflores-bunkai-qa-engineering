# ATC Spec: BK-553 — rejectPatDeleteTokenRevocation

> Ticket: BK-497
> Component: TokensApi (tests/components/api/TokensApi.ts) — NEW component
> Type: API — Negative (channel-based rejection)
> Parent Story: BK-497

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| rejectPatDeleteTokenRevocation | Verify a PAT-authenticated `DELETE /api/v1/tokens/{id}` is rejected (403) regardless of scope — the `cookie-only` lift on token revocation | Caller holds any valid minted PAT; a target token exists to attempt revoking | Response 403, verbatim message "Personal access tokens cannot revoke tokens. Use a browser session.", target's `revoked_at` unchanged |

## 2. ATC Contract

```typescript
/**
 * ATC: DELETE /api/v1/tokens/{targetTokenId} using a PAT (Bearer) as auth.
 * Fixed assertions:
 *  - 403 Forbidden
 *  - body.error.message === 'Personal access tokens cannot revoke tokens. Use a browser session.'
 */
@atc('BK-553')
async rejectPatDeleteTokenRevocation(
  targetTokenId: string,
): Promise<[APIResponse, ErrorEnvelope]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `DELETE /api/v1/tokens/{id}` |
| Path param | `targetTokenId` — a DIFFERENT token's id than the acting PAT (both minted fresh per test) |
| Error response | 403 `ErrorEnvelope` — `{ error: { code, message } }`, verbatim `message` |
| Auth | `this.authToken` ambient — set to the acting PAT by the test precondition before the call |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 403`
- `body.error.message === 'Personal access tokens cannot revoke tokens. Use a browser session.'`

### Test-level (in test file)
- `tokens.listTokens()` (same PAT) shows `targetTokenId`'s `revoked_at === null` — proves the
  target was unchanged. Test-level because it composes a second endpoint (GET).

## 5. Code Template

```typescript
@atc('BK-553')
async rejectPatDeleteTokenRevocation(
  targetTokenId: string,
): Promise<[APIResponse, ErrorEnvelope]> {
  const [response, body] = await this.apiDELETE<ErrorEnvelope>(`/api/v1/tokens/${targetTokenId}`);

  expect(response.status()).toBe(403);
  expect(body.error.message).toBe('Personal access tokens cannot revoke tokens. Use a browser session.');

  return [response, body];
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|----|-----------------|----------------|
| AC-04/05 non-regression (channel guard) | EP (always) | 1 — same single partition rationale as BK-552; no BVA/State-Transition/Decision-Table applicable |

## 7. Dependencies

- Precondition: `AuthApi.authenticateSuccessfully()`; `TokensApi.mintPatWithScopes()` ×2
  (acting PAT + target PAT).
- Required Components: `TokensApi` — new.

## 8. Data Context

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Acting PAT (any scope) | Generate | `tokens.mintPatWithScopes({ scopes: ['atc:read'] })` | `beforeEach` | None |
| Target token to attempt-revoke | Generate | Second `tokens.mintPatWithScopes({ scopes: ['atc:read'] })` call | `beforeEach` | None — `revoked_at` verified still null, no state to restore |

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `rejectPatDeleteTokenRevocation`
- [x] Max 2 positional params — 1 (`targetTokenId`)
- [x] Correct return type — tuple `[APIResponse, TBody]` for a DELETE
- [x] Fixed vs test-level assertions split (§4)
- [x] Not duplicating an existing ATC
