# ATC Spec: BK-552 — rejectPatPostTokenIssuance

> Ticket: BK-497
> Component: TokensApi (tests/components/api/TokensApi.ts) — NEW component
> Type: API — Negative (channel-based rejection)
> Parent Story: BK-497

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| rejectPatPostTokenIssuance | Verify a PAT-authenticated `POST /api/v1/tokens` is rejected (403) regardless of scope — the `cookie-only` lift on token issuance | Caller holds any valid minted PAT | Response 403, verbatim message "Personal access tokens cannot issue tokens. Use a browser session.", no row created for the attempted name |

## 2. ATC Contract

```typescript
/**
 * ATC: POST /api/v1/tokens using a PAT (Bearer) as auth.
 * Fixed assertions:
 *  - 403 Forbidden
 *  - body.error.message === 'Personal access tokens cannot issue tokens. Use a browser session.'
 */
@atc('BK-552')
async rejectPatPostTokenIssuance(
  overrides?: Partial<CreateTokenBody>,
): Promise<[APIResponse, ErrorEnvelope, CreateTokenBody]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `POST /api/v1/tokens` |
| Request body | `CreateTokenBody` — `{ name, scopes: Capability[] }` (minimal valid body; `this.data.createTestId('pat-attempt')` for `name`, `['atc:read']` default `scopes`, both overridable) |
| Error response | 403 `ErrorEnvelope` — `{ error: { code, message } }`, verbatim `message` |
| Auth | `this.authToken` ambient — set to the acting PAT by the test precondition before the call |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 403`
- `body.error.message === 'Personal access tokens cannot issue tokens. Use a browser session.'`

### Test-level (in test file)
- `tokens.listTokens()` (same PAT, GET is allowed for PATs) does not contain a token named
  the attempted `name` — proves zero rows created. Test-level because it composes a second
  endpoint (GET), per Rule 6 (fixed assertions only cover the response under test).

## 5. Code Template

```typescript
@atc('BK-552')
async rejectPatPostTokenIssuance(
  overrides?: Partial<CreateTokenBody>,
): Promise<[APIResponse, ErrorEnvelope, CreateTokenBody]> {
  const body: CreateTokenBody = {
    name: this.data.createTestId('pat-attempt'),
    scopes: ['atc:read'],
    ...overrides,
  };
  const [response, respBody, sentPayload] = await this.apiPOST<ErrorEnvelope, CreateTokenBody>(
    '/api/v1/tokens',
    body,
  );

  expect(response.status()).toBe(403);
  expect(respBody.error.message).toBe('Personal access tokens cannot issue tokens. Use a browser session.');

  return [response, respBody, sentPayload];
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|----|-----------------|----------------|
| AC-04/05 non-regression (channel guard) | EP (always) | 1 — "any valid PAT" is a single partition per the TC's own text ("rejection is channel-based, not scope-based"); no BVA (no range/limit), no State-Transition (no status field), no Decision Table (single condition: auth channel) |

**Equivalence Partitioning detail:**
| Input | Expected output | Same ATC? |
|---|---|---|
| PAT with any scope combination | 403, same message | Yes — channel-based, scope-irrelevant per TC design |

## 7. Dependencies

- Precondition: `AuthApi.authenticateSuccessfully()` (existing) for the fresh session;
  `TokensApi.mintPatWithScopes()` (new, this plan) for the acting PAT.
- Required Components: `TokensApi` — new.

## 8. Data Context

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Any valid PAT | Generate | `tokens.mintPatWithScopes({ scopes: ['atc:read'] })` | `beforeEach` | None (see automation-plan.md §4) |

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `rejectPatPostTokenIssuance`
- [x] Max 2 positional params — 1 (optional object param)
- [x] Correct return type — tuple `[APIResponse, TBody, TPayload]` for a POST
- [x] Fixed vs test-level assertions split (§4)
- [x] Not duplicating an existing ATC — checked `kata-manifest.json`, no Tokens/PAT component exists
