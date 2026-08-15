/**
 * KATA Framework - Type Facade: Notifications Domain
 *
 * Wired to the real `GET /api/v1/workspaces/{id}/notifications` endpoint.
 *
 * Consumed by: tests/components/api/NotificationsApi.ts
 */

import type { components } from '@openapi';

// ============================================================================
// Endpoint Types - GET /api/v1/workspaces/{id}/notifications
// ============================================================================

/** One page of the caller's notification inbox for a workspace, newest first. */
export type NotificationsPage = components['schemas']['NotificationsPage'];

/** Single notification row — event_type, entity_type/id, producer payload snapshot. */
export type NotificationItem = components['schemas']['NotificationItem'];
