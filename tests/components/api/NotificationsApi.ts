/**
 * KATA Architecture - Layer 3: Notifications API Component
 *
 * API component for reading a caller's per-workspace notification inbox.
 * Read-only so far — no ATCs. Consumed as a test-level verification step
 * by TCs that assert a write elsewhere in the app fans out a notification
 * (e.g. BK-489, defect assignment -> notifications row for BK-212).
 *
 * Endpoints:
 * - GET /workspaces/{id}/notifications - List the caller's notification inbox, newest first
 */

import type { APIResponse } from '@playwright/test';
import type { NotificationsPage } from '@schemas/notifications.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { step } from '@utils/decorators';

// Re-export types for consumers that import from NotificationsApi
export type { NotificationItem, NotificationsPage } from '@schemas/notifications.types';

// ============================================
// Notifications API Component
// ============================================

export class NotificationsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  /**
   * Helper: List the caller's notification inbox for one workspace.
   *
   * Read-only GET, newest first — used as a test-level verification step to
   * confirm a write elsewhere triggered the expected notification row. Not
   * an ATC on its own.
   *
   * @param workspaceId - Target workspace id
   * @returns Tuple with response and the notification page
   */
  @step
  async getNotifications(workspaceId: string): Promise<[APIResponse, NotificationsPage]> {
    const [response, body] = await this.apiGET<NotificationsPage>(`/workspaces/${workspaceId}/notifications`);
    return [response, body];
  }
}
