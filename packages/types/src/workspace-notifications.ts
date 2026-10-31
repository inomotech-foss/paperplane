/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ENotificationFilterType } from "./enums";
import type { IUserLite } from "./users";

// filters
export type TNotificationFilter = {
  type: {
    [key in ENotificationFilterType]: boolean;
  };
  snoozed: boolean;
  archived: boolean;
  read: boolean;
};

// notification payload
export type TNotificationIssueLite = {
  id: string | undefined;
  sequence_id: number | undefined;
  identifier: string | undefined;
  name: string | undefined;
  state_name: string | null | undefined;
  state_group: string | null | undefined;
};

export type TNotificationPageLite = {
  id: string | undefined;
  name: string | undefined;
  project_id: string | undefined;
  workspace_slug: string | undefined;
};

/** Each key is present only for its kind of notification. */
export type TNotificationData = {
  issue?: TNotificationIssueLite | undefined;
  issue_activity?: {
    id: string | null | undefined;
    actor: string | null | undefined;
    field: string | null | undefined;
    issue_comment?: string | undefined;
    verb: string;
    new_value: string | undefined;
    old_value: string | undefined;
  };
  page?: TNotificationPageLite | undefined;
  comment?: { id: string | undefined } | undefined;
};

export type TNotification = {
  id: string;
  title: string | undefined;
  data: TNotificationData | null | undefined;
  entity_identifier: string | null | undefined;
  entity_name: string | undefined;
  message_html: string | undefined;
  message: string | null | undefined;
  message_stripped: string | null | undefined;
  sender: string | undefined;
  receiver: string | undefined;
  triggered_by: string | null | undefined;
  triggered_by_details: IUserLite | null | undefined;
  read_at: string | null | undefined;
  archived_at: string | null | undefined;
  snoozed_till: string | null | undefined;
  is_inbox_issue?: boolean;
  is_mentioned_notification?: boolean;
  workspace: string | undefined;
  project: string | null | undefined;
  created_at: string | undefined;
  updated_at: string | undefined;
  created_by: string | null | undefined;
  updated_by: string | null | undefined;
};

// notification paginated information
export type TNotificationPaginatedInfoQueryParams = {
  type?: string | undefined;
  snoozed?: boolean;
  archived?: boolean;
  mentioned?: boolean;
  read?: boolean;
  per_page?: number;
  cursor?: string;
};

export type TNotificationPaginatedInfo = {
  next_cursor: string | undefined;
  prev_cursor: string | undefined;
  next_page_results: boolean | undefined;
  prev_page_results: boolean | undefined;
  total_pages: number | undefined;
  extra_stats: unknown;
  count: number | undefined; // current paginated results count
  total_count: number | undefined; // total available results count
  results: TNotification[] | undefined;
  grouped_by: string | null | undefined;
  sub_grouped_by: string | null | undefined;
};

// notification count
export type TUnreadNotificationsCount = {
  total_unread_notifications_count: number;
  mention_unread_notifications_count: number;
};

export type TNotificationLite = {
  workspace_slug: string | undefined;
  project_id: string | null | undefined;
  notification_id: string | undefined;
  issue_id: string | null | undefined;
  is_inbox_issue?: boolean;
};
