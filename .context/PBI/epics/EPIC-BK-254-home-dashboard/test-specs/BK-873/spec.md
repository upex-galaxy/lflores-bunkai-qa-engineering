# BK-873: Workspace coverage endpoint is gated by PAT scope

| Field | Value |
|-------|-------|
| **Priority** | High (TC priority) |
| **Phase** | Standalone |
| **Items** | 1 TC (Scenario Outline, 2 examples) |
| **Dependencies** | BK-872 (`CoverageApi`, `WorkspaceCoverage` facade, `ApiFixture` wiring) |
| **Requires** | Cached `member` identity with a live session (PAT minting is cookie-only) |
| **Source** | Story: BK-259 (TMS-Home, Show workspace test coverage summary), TC10 |

## Summary

`GET /api/v1/workspaces/{id}/coverage` declares `requires: ['atc:read']`. A PAT holding `atc:read`
reads it (200); a PAT holding only `atc:write` is rejected (403) because the capability check is an
exact-match membership test, not a hierarchy. Cookie sessions hold the full capability set, so the
gate constrains PATs only. This guards the one place a route could silently lose its `requires`
declaration and become readable by any PAT.

Regression guard for an already-signed manual result (ATR BK-878: TC10 PASSED). The gate itself is
proven on other routes by BK-673 to BK-677 (BK-499); none of them touches the coverage route.

## Preconditions

- `member` identity cached by `api-setup`, with a session that outlives the run (needed to mint PATs).
- The member belongs to at least one workspace.

## Test Cases

### BK-873: should gate the coverage endpoint by PAT scope

**Preconditions**: Two PATs owned by a member of `{workspace_id}`, one scoped `atc:read` and one scoped `atc:write` only.
**Action**: `GET /api/v1/workspaces/{id}/coverage` with each PAT.
**Expected Output**:

| Scope | Status | Extra |
|---|---|---|
| `atc:read` | 200 | body has the workspace-coverage shape |
| `atc:write` | 403 | error message names the missing `atc:read` capability |

```gherkin
@regression @integration @BK-259
Scenario Outline: BK-873 - should gate the coverage endpoint by PAT scope
  Given a PAT scoped "<scope>" owned by a member of the workspace
  When the PAT requests GET /api/v1/workspaces/{id}/coverage
  Then the response status is <status>

  Examples:
    | scope     | status |
    | atc:read  | 200    |
    | atc:write | 403    |
```

## Notes

- The TC body names `{workspace_id}` as a variable: the test uses the member's own first workspace.
- PATs are minted unbound (no `workspace_id`) and revoked at the end of the test.
