# Measured Gotchas

> Loaded by: `business-data-context`, when reading this project's data map could mislead a competent session. Every row was measured on the date given against the source it names. Rows that stop being true move to §"No longer true"; they are never deleted. Proposed and applied per `agentic-qa-core/references/skill-refinement-protocol.md`.

## 1 · Reading the map

| # | Gotcha | Symptom | Fix | Measured | Verified against |
|---|---|---|---|---|---|
| 1 | The staging read-only DB role (`qa_inspector_ro`, the `db_mcp` of the active env) cannot see triggers through `information_schema` nor read the `cron` schema | `information_schema.triggers` returns 0 rows and `select ... from cron.job` fails with `permission denied for schema cron`, which reads as "no triggers, no scheduled jobs" | List triggers from `pg_trigger` joined to `pg_proc` (filter `not tgisinternal`); read pg_cron jobs from the backend migrations (`git grep -n "cron.schedule" -- supabase/migrations` in the backend repo) | 2026-11-13 | staging DB via the dbhub MCP; `upex-bunkai-tms` migrations at `origin/staging` |

## 2 · No longer true

_(empty)_
