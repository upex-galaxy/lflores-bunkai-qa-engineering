# ADR-0027 — `data-testid` is the UI selector contract

- **Status:** Accepted
- **Date:** 2026-11-13
- **Deciders:** QA lead (Luis Flores), approved in the project-discovery review of 2026-11-13 (session bunkai-qa-engineering-f6). Discovered, not designed, in that session.
- **Tags:** selector-contract
- **Supersedes:** —
- **Superseded by:** —

---

## Context

The target ships `data-testid` across its components (kebab-case, an area prefix, the entity id appended for rows; `bun run context:map infra-context --section frontend`), documents the login test ids on its public `/qa` page, and uses no `data-cy`. The app has no i18n bundle, so visible text already differs between screens for the same concept (`bun run context:map business-domain-context --section discovery-gaps`).

## Decision

We will locate UI elements in Page components by `data-testid` first and by ARIA role with an accessible name second; visible text is never the only anchor. A missing test id is reported to the dev team instead of being worked around with CSS classes or XPath.

## Consequences

- **Positive:** selectors survive copy and label changes.
- **Negative / trade-offs:** stability depends on the dev team keeping ids unchanged; an id used twice on one page (for example `login-email`) must be scoped to its container.
- **Neutral / follow-ups:** new screens without ids become a request to the dev team.

## Alternatives considered

- **Role and text first**: breaks on the label drift the app already shows.
- **CSS classes**: Tailwind utility classes are not stable identifiers.

## References

- `bun run context:map infra-context --section frontend` (test IDs strategy)
- Target `/qa` page (login test ids)
