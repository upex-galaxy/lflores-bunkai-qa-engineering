# ATC Spec: BK-546 — rejectInvalidBearerBeforePostureCheck

> Ticket: BK-497
> Component: TokensApi (tests/components/api/TokensApi.ts) — NEW component
> Type: API — Negative (Error Guessing — auth-resolution ordering)
> Parent Story: BK-497

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| rejectInvalidBearerBeforePostureCheck | Verify identity resolution (`resolveIdentity`) fails and returns 401 BEFORE the `cookie-only` posture check runs (would otherwise return 403) | An invalid/malformed Bearer token string | Response 401 (not 403), message "Invalid token." |

## 2. ATC Contract

```typescript
/**
 * ATC: POST /api/v1/tokens using a syntactically-invalid Bearer token.
 * Fixed assertions:
 *  - 401 Unauthorized (NOT 403 — proves resolveIdentity runs first)
 *  - body.error.message === 'Invalid token.'
 */
@atc('BK-546')
async rejectInvalidBearerBeforePostureCheck(
  invalidToken?: string,
): Promise<[APIResponse, ErrorEnvelope]> { /* ... */ }
```

## 3A. API Details

| Aspect | Value |
|---|---|
| Endpoint | `POST /api/v1/tokens` (chosen because it's the one route where 401-vs-403 is observable — a valid-but-unauthorized PAT gets 403 per BK-552, so a genuinely invalid token must be distinguishable at 401) |
| Request body | Minimal valid `CreateTokenBody` — body content is irrelevant, auth fails before body validation |
| Error response | 401 `ErrorEnvelope` — `{ error: { code: 'unauthorized', message: 'Invalid token.' } }` |
| Auth | `this.authToken` set to `invalidToken ?? INVALID_BEARER_TOKEN` (constant, `tests/data/constants.ts`) |

## 4. Assertions Split

### Fixed (inside ATC)
- `response.status() === 401`
- `body.error.message === 'Invalid token.'`

### Test-level (in test file)
- None — single-call, no composition needed.

## 5. Code Template

```typescript
@atc('BK-546')
async rejectInvalidBearerBeforePostureCheck(
  invalidToken?: string,
): Promise<[APIResponse, ErrorEnvelope]> {
  this.setAuthToken(invalidToken ?? INVALID_BEARER_TOKEN);

  const [response, body] = await this.apiPOST<ErrorEnvelope, CreateTokenBody>('/api/v1/tokens', {
    name: this.data.createTestId('pat-attempt'),
    scopes: ['atc:read'],
  });

  expect(response.status()).toBe(401);
  expect(body.error.message).toBe('Invalid token.');

  return [response, body];
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|----|-----------------|----------------|
| Error Guessing charter (not AC-derived — auth-resolution ordering the ACs are silent on) | Error Guessing (explicit trigger per `test-design-doctrine.md`) | 1 |

**Note**: originated as an Error Guessing charter (TC-16 in the ATP), not an AC-derived case —
explicitly recommended in `acceptance-test-results.md` §Recommendations as a real, deterministic,
cheap-to-assert regression guard.

## 7. Dependencies

- Precondition: none (no valid session/PAT needed — the invalid token IS the precondition).
- Required Components: `TokensApi` — new.

## 8. Data Context

| Precondition | Pattern | Source | Placement | Cleanup |
|---|---|---|---|---|
| Invalid/malformed Bearer token | N/A — static constant | `INVALID_BEARER_TOKEN` in `tests/data/constants.ts` | Constant | N/A |

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `rejectInvalidBearerBeforePostureCheck`
- [x] Max 2 positional params — 1 (optional `invalidToken`)
- [x] Correct return type — tuple `[APIResponse, TBody]`
- [x] Fixed vs test-level assertions split (§4)
- [x] Not duplicating an existing ATC
