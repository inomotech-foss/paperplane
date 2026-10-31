/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema, InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import type {
  TUnreadNotificationsCount,
  TNotificationPaginatedInfo,
  TNotification,
  TNotificationPaginatedInfoQueryParams,
} from "@plane/types";
import type { ApiClient } from "../client";
import { createApiClient, unwrap } from "../client";

const flag = (value: boolean | undefined) => (value === undefined ? undefined : value ? "true" : "false");

const notificationPath = (slug: string, pk: string) => ({ path: { slug, pk } });

/** Errors are thrown as `ApiError`. */
export class WorkspaceNotificationService {
  private readonly client: ApiClient<InternalPaths>;

  constructor(BASE_URL?: string) {
    this.client = createApiClient<InternalPaths>(BASE_URL || API_BASE_URL);
  }

  /**
   * Retrieves the count of unread notifications for a workspace
   * @param {string} workspaceSlug - The unique identifier for the workspace
   * @returns {Promise<TUnreadNotificationsCount>} The count of unread notifications
   */
  async getUnreadCount(workspaceSlug: string): Promise<TUnreadNotificationsCount> {
    return unwrap(
      this.client.GET("/api/workspaces/{slug}/users/notifications/unread/", {
        params: { path: { slug: workspaceSlug } },
      })
    );
  }

  /**
   * Retrieves paginated notifications for a workspace
   * @param {string} workspaceSlug - The unique identifier for the workspace
   * @param {TNotificationPaginatedInfoQueryParams} params - Query parameters for pagination and filtering
   * @returns {Promise<TNotificationPaginatedInfo | undefined>} `undefined` when the API answers with a plain list,
   * which it does unless `per_page` and `cursor` are sent
   */
  async list(
    workspaceSlug: string,
    params: TNotificationPaginatedInfoQueryParams
  ): Promise<TNotificationPaginatedInfo | undefined> {
    const data = await unwrap(
      this.client.GET("/api/workspaces/{slug}/users/notifications/", {
        params: {
          path: { slug: workspaceSlug },
          query: {
            type: params.type,
            snoozed: flag(params.snoozed),
            archived: flag(params.archived),
            read: flag(params.read),
            mentioned: params.mentioned ? "true" : undefined,
            per_page: params.per_page,
            cursor: params.cursor,
          },
        },
      })
    );
    return Array.isArray(data) ? undefined : data;
  }

  /**
   * Sets or clears when a notification is snoozed till, the only field the API updates.
   * @param {string} workspaceSlug - The unique identifier for the workspace
   * @param {string} notificationId - The unique identifier for the notification
   * @param {string | null} snoozedTill - The new snooze time, null to clear it
   * @returns {Promise<TNotification>} The updated notification
   */
  async snooze(workspaceSlug: string, notificationId: string, snoozedTill: string | null): Promise<TNotification> {
    return unwrap(
      this.client.PATCH("/api/workspaces/{slug}/users/notifications/{pk}/", {
        params: notificationPath(workspaceSlug, notificationId),
        body: { snoozed_till: snoozedTill },
      })
    );
  }

  async markAsRead(workspaceSlug: string, notificationId: string): Promise<TNotification> {
    return unwrap(
      this.client.POST("/api/workspaces/{slug}/users/notifications/{pk}/read/", {
        params: notificationPath(workspaceSlug, notificationId),
      })
    );
  }

  async markAsUnread(workspaceSlug: string, notificationId: string): Promise<TNotification> {
    return unwrap(
      this.client.DELETE("/api/workspaces/{slug}/users/notifications/{pk}/read/", {
        params: notificationPath(workspaceSlug, notificationId),
      })
    );
  }

  async archive(workspaceSlug: string, notificationId: string): Promise<TNotification> {
    return unwrap(
      this.client.POST("/api/workspaces/{slug}/users/notifications/{pk}/archive/", {
        params: notificationPath(workspaceSlug, notificationId),
      })
    );
  }

  async unarchive(workspaceSlug: string, notificationId: string): Promise<TNotification> {
    return unwrap(
      this.client.DELETE("/api/workspaces/{slug}/users/notifications/{pk}/archive/", {
        params: notificationPath(workspaceSlug, notificationId),
      })
    );
  }

  /**
   * Marks all notifications as read based on filter criteria
   * @param {string} workspaceSlug - The unique identifier for the workspace
   * @param {TNotificationPaginatedInfoQueryParams} data - Filter criteria for notifications to mark as read
   */
  async markAllAsRead(
    workspaceSlug: string,
    data: TNotificationPaginatedInfoQueryParams
  ): Promise<ApiSchema<"MessageResponse">> {
    return unwrap(
      this.client.POST("/api/workspaces/{slug}/users/notifications/mark-all-read/", {
        params: { path: { slug: workspaceSlug } },
        body: data,
      })
    );
  }
}
