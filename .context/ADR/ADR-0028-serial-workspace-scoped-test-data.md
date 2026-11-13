# ADR-0028 — Serial, workspace-scoped test data on the shared Supabase project

- **Status:** Accepted
- **Date:** 2026-11-13
- **Deciders:** QA lead (Luis Flores), approved in the project-discovery review of 2026-11-13 (session bunkai-qa-engineering-f6). Discovered, not designed, in that session.
- **Tags:** isolation, test-data
- **Supersedes:** —
- **Superseded by:** —

---

## Context

One Supabase project backs local, staging and production (`bun run context:map infra-context --section environments`), so test data lives next to real data. This repo runs `workers: 1`, `fullyParallel: false` and `retries: 0` (`playwright.config.ts`), and recent fixes revoke the data a test creates in a `finally` block.

## Decision

We will run suites serially, create test data only inside workspaces reserved for QA identities, and clean up what a test created in `finally`. No suite deletes data it did not create, and no destructive sweep runs against the shared project.

## Consequences

- **Positive:** safe next to production rows; failures are not caused by parallel tests sharing data.
- **Negative / trade-offs:** slow, no parallelism; a crashed run can leave orphan rows that need a targeted cleanup.
- **Neutral / follow-ups:** revisit if a separate test database or per-worker workspaces become available.

## Alternatives considered

- **Parallel workers with one workspace each**: needs more identities and seat headroom than staging has.
- **A separate test database**: not available, there is one project.

## References

- `bun run context:map infra-context --section environments`, `.agents/instructions/agent-project.md` (Project Assessment risks)
- `playwright.config.ts`
