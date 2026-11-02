// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { EventToPayloadMap } from "@plane/editor";
import { isRecord, readField, readString } from "@plane/types";

/** A page event the live server broadcasts as JSON, as opposed to a bare event name. */
export type TRealtimePageEvent =
  | { pageIds: string[]; action: "property_updated"; data: EventToPayloadMap["property_updated"] }
  | { pageIds: string[]; action: "error"; data: EventToPayloadMap["error"] };

const ERROR_CODES = ["content_too_large", "page_locked", "page_archived"] as const;

const toPropertyUpdate = (data: unknown): EventToPayloadMap["property_updated"] => {
  const update: EventToPayloadMap["property_updated"] = {};
  const name = readString(data, "name");
  if (name !== undefined) update.name = name;
  const updatedAt = readString(data, "updated_at");
  if (updatedAt !== undefined) update.updated_at = updatedAt;
  const updatedBy = readField(data, "updated_by");
  if (typeof updatedBy === "string" || updatedBy === null) update.updated_by = updatedBy;
  return update;
};

const toError = (data: unknown): EventToPayloadMap["error"] | null => {
  const errorType = readString(data, "error_type");
  if (errorType !== "fetch" && errorType !== "store") return null;
  const code = readString(data, "error_code");
  return {
    error_message: readString(data, "error_message") ?? "",
    error_type: errorType,
    error_code: ERROR_CODES.find((value) => value === code),
    should_disconnect: readField(data, "should_disconnect") === true,
  };
};

const parseJson = (payload: string): unknown => {
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
};

/** Reads a JSON stateless message. Bare event names and unknown actions give null. */
export const parseRealtimePageEvent = (payload: unknown): TRealtimePageEvent | null => {
  if (typeof payload !== "string" || !payload.startsWith("{")) return null;
  const message = parseJson(payload);
  const affectedPages = readField(message, "affectedPages");
  const currentPage = readString(affectedPages, "currentPage");
  const descendants = readField(affectedPages, "descendantPages");
  const descendantIds: unknown[] = Array.isArray(descendants) ? descendants.map((id: unknown) => id) : [];
  const pageIds = [currentPage, ...descendantIds].filter((id): id is string => typeof id === "string" && id !== "");
  const data = readField(message, "data");
  if (pageIds.length === 0 || !isRecord(data)) return null;

  const action = readString(message, "action");
  if (action === "property_updated") return { pageIds, action, data: toPropertyUpdate(data) };
  if (action === "error") {
    const error = toError(data);
    return error ? { pageIds, action, data: error } : null;
  }
  return null;
};
