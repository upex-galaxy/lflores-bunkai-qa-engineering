# Measured Gotchas

> Loaded by: `business-e2e-context`, when reading this project's e2e map could mislead a competent session. Every row was measured on the date given against the source it names. Rows that stop being true move to §"No longer true"; they are never deleted. Proposed and applied per `agentic-qa-core/references/skill-refinement-protocol.md`.

## 1 · Reading the map

| # | Gotcha | Symptom | Fix | Measured | Verified against |
|---|---|---|---|---|---|
| 1 | The sidebar entries Test Runs, Bug Reports and Metrics are not workspace-wide pages: each opens that section inside the current project (`/projects/<slug>/runs`, `/bugs`, `/metrics`) | a test or exploratory session expects a cross-project list and finds only one project's runs or bugs | navigate from the project you mean, or read the cross-project numbers on `/home` | 2026-11-13 | `upex-bunkai-tms` `components/layout/AppSidebar.tsx` (`projectSectionHref`) at `63d5e7e3` |

## 2 · No longer true

_(empty)_
