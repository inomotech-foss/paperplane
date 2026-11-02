/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
// plane imports
import type { TNotification } from "@plane/types";
import {
  convertMinutesToHoursMinutesString,
  renderFormattedDate,
  sanitizeCommentForNotification,
  stripAndTruncateHTML,
} from "@plane/utils";
// components
import { LiteTextEditor } from "@/components/editor/lite-text";
import {
  ADDITIONAL_NOTIFICATION_CONTENT_MAP,
  renderAdditionalAction,
  renderAdditionalValue,
  shouldShowConnector,
} from "../../notification-card/content";

// Types
export type TNotificationFieldData = {
  field: string | undefined;
  newValue: string | undefined;
  oldValue: string | undefined;
  verb: string | undefined;
};

export type TNotificationContentDetails = {
  action?: ReactNode;
  value?: ReactNode;
  showConnector?: boolean;
};

export type TNotificationContentHandler = (
  data: TNotificationFieldData,
  renderCommentBox?: boolean
) => TNotificationContentDetails | null;

export type TNotificationContentMap = {
  [key: string]: TNotificationContentHandler;
};

const relationContent =
  (relation: string): TNotificationContentHandler =>
  ({ verb, newValue, oldValue }) =>
    verb === "deleted"
      ? { action: `marked that this work item is no longer ${relation}`, value: oldValue, showConnector: false }
      : { action: `marked that this work item is ${relation}`, value: newValue, showConnector: false };

// Base notification content map for core fields
export const BASE_NOTIFICATION_CONTENT_MAP: TNotificationContentMap = {
  relates_to: relationContent("related to"),
  blocking: relationContent("blocking"),
  blocked_by: relationContent("blocked by"),
  duplicate: relationContent("a duplicate of"),
  assignees: ({ newValue, oldValue }) => ({
    action: newValue !== "" ? "added assignee" : "removed assignee",
    value: newValue !== "" ? newValue : oldValue,
    showConnector: false,
  }),
  start_date: ({ newValue }) => ({
    action: newValue !== "" ? "set start date" : "removed the start date",
    value: renderFormattedDate(newValue),
    showConnector: false,
  }),
  target_date: ({ newValue }) => ({
    action: newValue !== "" ? "set due date" : "removed the due date",
    value: renderFormattedDate(newValue),
    showConnector: false,
  }),
  labels: ({ newValue, oldValue }) => ({
    action: newValue !== "" ? "added label" : "removed label",
    value: newValue !== "" ? newValue : oldValue,
    showConnector: false,
  }),
  parent: ({ newValue, oldValue }) => ({
    action: newValue !== "" ? "added parent" : "removed parent",
    value: newValue !== "" ? newValue : oldValue,
    showConnector: false,
  }),
  comment: ({ newValue }, renderCommentBox?: boolean) => ({
    action: "commented",
    value: renderCommentBox ? null : sanitizeCommentForNotification(newValue),
    showConnector: false,
  }),
  archived_at: ({ newValue }) => ({
    action: newValue === "restore" ? "restored the work item" : "archived the work item",
    value: null,
    showConnector: false,
  }),
  None: () => ({
    action: null,
    value: "the work item and assigned it to you.",
    showConnector: false,
  }),
  // Fields below only define value - action falls through to default handler
  attachment: () => ({
    action: null,
    value: "the work item",
    showConnector: true,
  }),
  description: ({ newValue }) => ({
    value: stripAndTruncateHTML(newValue || "", 55),
    showConnector: true,
  }),
  estimate_time: ({ newValue, oldValue }) => ({
    value:
      newValue !== ""
        ? convertMinutesToHoursMinutesString(Number(newValue))
        : convertMinutesToHoursMinutesString(Number(oldValue)),
    showConnector: true,
  }),
};

// Helper to get content details from maps
const getNotificationContentDetails = (
  fieldData: TNotificationFieldData,
  renderCommentBox?: boolean
): TNotificationContentDetails | null => {
  const { field } = fieldData;
  if (!field) return null;

  // Check base map first
  const baseHandler = BASE_NOTIFICATION_CONTENT_MAP[field];
  if (baseHandler) {
    // Special case for comment field that needs renderCommentBox
    if (field === "comment") {
      return baseHandler(fieldData, renderCommentBox);
    }
    return baseHandler(fieldData);
  }

  // Check additional map from plane-web (EE extensions)
  const additionalHandler = ADDITIONAL_NOTIFICATION_CONTENT_MAP[field];
  if (additionalHandler) {
    return additionalHandler(fieldData);
  }

  return null;
};

export function NotificationContent({
  notification,
  workspaceId,
  workspaceSlug,
  projectId,
  renderCommentBox = false,
}: {
  notification: TNotification;
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  renderCommentBox?: boolean;
}) {
  const { data, triggered_by_details: triggeredBy } = notification;
  const notificationField = data?.issue_activity?.field ?? undefined;
  const newValue = data?.issue_activity?.new_value;
  const oldValue = data?.issue_activity?.old_value;
  const verb = data?.issue_activity?.verb;

  const fieldData: TNotificationFieldData = {
    field: notificationField,
    newValue,
    oldValue,
    verb,
  };

  const renderTriggerName = () => (
    <span className="font-medium text-primary">
      {triggeredBy?.is_bot ? triggeredBy.first_name : triggeredBy?.display_name}{" "}
    </span>
  );

  // Get content details from map
  const contentDetails = getNotificationContentDetails(fieldData, renderCommentBox);

  // Render action - use map value if defined, otherwise fall through to default handler
  // Note: undefined = fall through to default, null = explicitly no action text
  const renderAction = (): ReactNode => {
    if (!notificationField) return "";
    // Check if action is explicitly defined in map (including null)
    if (contentDetails && "action" in contentDetails) return contentDetails.action;
    // Fallback to default action handler for fields not in map or without action defined
    return renderAdditionalAction(notificationField, verb);
  };

  // Render value - use map value if defined, otherwise fall through to default handler
  const renderValue = (): ReactNode => {
    // Check if value is explicitly defined in map
    if (contentDetails && "value" in contentDetails) return contentDetails.value;
    if (verb === "deleted") return null;
    // Fallback to default value handler for fields not in map or without value defined
    return renderAdditionalValue(notificationField, newValue, oldValue);
  };

  // Determine if connector should be shown - prefer map value, fallback to function
  const showConnector =
    contentDetails?.showConnector !== undefined ? contentDetails.showConnector : shouldShowConnector(notificationField);

  const value = renderValue();
  const hasValue = value !== null && value !== undefined && value !== "";

  return (
    <>
      {renderTriggerName()}
      <span className="text-tertiary">{renderAction()}</span>
      {hasValue && (
        <>
          {showConnector && <span className="text-tertiary"> to</span>}{" "}
          <span className="font-medium text-primary">{value}</span>
        </>
      )}
      {verb !== "deleted" && notificationField === "comment" && renderCommentBox && (
        <div className="origin-left scale-75">
          <LiteTextEditor
            editable={false}
            id=""
            initialValue={newValue ?? ""}
            workspaceId={workspaceId}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            displayConfig={{
              fontSize: "small-font",
            }}
          />
        </div>
      )}
      {"."}
    </>
  );
}
