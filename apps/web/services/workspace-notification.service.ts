/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import { unwrap } from "@plane/services";
import type {
  TNotificationPaginatedInfo,
  TNotificationPaginatedInfoQueryParams,
  TNotification,
  TUnreadNotificationsCount,
} from "@plane/types";
import { apiClient } from "@/services/api-client";

export type TMessageResponse = ApiSchema<"MessageResponse">;

const flag = (value: boolean | undefined) => (value === undefined ? undefined : value ? "true" : "false");

const notificationPath = (slug: string, pk: string) => ({ path: { slug, pk } });

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class WorkspaceNotificationService {
  async fetchUnreadNotificationsCount(workspaceSlug: string): Promise<TUnreadNotificationsCount> {
    return unwrap(
      apiClient.GET("/api/workspaces/{slug}/users/notifications/unread/", { params: { path: { slug: workspaceSlug } } })
    );
  }

  /** `undefined` when the API answers with a plain list, which it does unless `per_page` and `cursor` are sent. */
  async fetchNotifications(
    workspaceSlug: string,
    params: TNotificationPaginatedInfoQueryParams
  ): Promise<TNotificationPaginatedInfo | undefined> {
    const data = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/users/notifications/", {
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

  /** Sets or clears the snooze, the only field the API updates. */
  async snoozeNotificationById(
    workspaceSlug: string,
    notificationId: string,
    snoozedTill: string | null
  ): Promise<TNotification> {
    return unwrap(
      apiClient.PATCH("/api/workspaces/{slug}/users/notifications/{pk}/", {
        params: notificationPath(workspaceSlug, notificationId),
        body: { snoozed_till: snoozedTill },
      })
    );
  }

  async markNotificationAsRead(workspaceSlug: string, notificationId: string): Promise<TNotification> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/users/notifications/{pk}/read/", {
        params: notificationPath(workspaceSlug, notificationId),
      })
    );
  }

  async markNotificationAsUnread(workspaceSlug: string, notificationId: string): Promise<TNotification> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/users/notifications/{pk}/read/", {
        params: notificationPath(workspaceSlug, notificationId),
      })
    );
  }

  async markNotificationAsArchived(workspaceSlug: string, notificationId: string): Promise<TNotification> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/users/notifications/{pk}/archive/", {
        params: notificationPath(workspaceSlug, notificationId),
      })
    );
  }

  async markNotificationAsUnArchived(workspaceSlug: string, notificationId: string): Promise<TNotification> {
    return unwrap(
      apiClient.DELETE("/api/workspaces/{slug}/users/notifications/{pk}/archive/", {
        params: notificationPath(workspaceSlug, notificationId),
      })
    );
  }

  async markAllNotificationsAsRead(
    workspaceSlug: string,
    payload: TNotificationPaginatedInfoQueryParams
  ): Promise<TMessageResponse> {
    return unwrap(
      apiClient.POST("/api/workspaces/{slug}/users/notifications/mark-all-read/", {
        params: { path: { slug: workspaceSlug } },
        body: payload,
      })
    );
  }
}

const workspaceNotificationService = new WorkspaceNotificationService();

export default workspaceNotificationService;
