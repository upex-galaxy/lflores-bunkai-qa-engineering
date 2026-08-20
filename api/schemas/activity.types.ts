/**
 * KATA Framework - Type Facade: Activity Domain
 *
 * Wired to the real `GET /api/v1/activity` endpoint (BK-49, BK-264 Slice 4).
 *
 * Schema note: `api/openapi-types.ts`'s generated `ActivityItem` union does
 * NOT include the bug-domain variants (`bug.assigned`, `bug.reassigned`,
 * `bug.unassigned`, `bug.status_changed`) even though the live endpoint
 * returns them — the backend's own OpenAPI description still says "no
 * defect activity" (schema/runtime drift, re-confirmed live 2026-08-20; see
 * .context/PBI/epics/EPIC-BK-31-bugs-defect-heatmap/test-specs/DT-T13-attribution-non-spoofable/spec.md).
 * `ActivityItemResponse` below is therefore a hand-authored envelope type,
 * not a narrow re-export like the rest of this repo's facades — the
 * generator has nothing to re-export for the bug variant yet. It reuses the
 * two generic schema components the generator DOES expose (`ActivityActor`,
 * `ActivityItemLabel`, both shared verbatim across every real variant) and
 * widens `action`/`entity_type`/`payload` to plain `string`/loose-object so
 * it structurally accepts any feed row, bug-domain included.
 *
 * Consumed by: tests/components/api/BugsApi.ts
 */

import type { components } from '@openapi';

// ============================================================================
// Endpoint Types - GET /api/v1/activity
// ============================================================================

/** Generic actor shape — `{ user_id, email }`, identical across every activity variant. */
export type ActivityActor = components['schemas']['ActivityActor'];

/** Generic item label shape — `{ label, entity_id }`, identical across every activity variant. */
export type ActivityItemLabel = components['schemas']['ActivityItemLabel'];

/**
 * One row of the activity feed. Widened beyond the generated `ActivityItem`
 * union to also admit bug-domain rows (see header note) — `payload` is a
 * passthrough object since its shape varies per `action`.
 */
export interface ActivityItemResponse {
  id: string
  entity_type: string
  action: string
  action_label: string
  actor: ActivityActor
  item: ActivityItemLabel
  payload: Record<string, unknown>
  created_at: string
}

/** One page of the activity feed — `{ items, next_cursor }`, keyset-paginated newest-first. */
export interface ActivityPageResponse {
  items: ActivityItemResponse[]
  next_cursor: string | null
}
