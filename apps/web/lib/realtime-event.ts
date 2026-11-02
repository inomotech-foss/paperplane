// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { EventToPayloadMap } from "@plane/editor";
import { isRecord, readField, readString } from "@plane/types";

/** A page event the live server broadcasts as JSON, as opposed to a bare event name. */
export type TRealtimePageEvent = { pageId: string; parentPageId: string | null } & (
  | { action: "property_updated"; data: EventToPayloadMap["property_updated"] }
  | { action: "error"; data: EventToPayloadMap["error"] }
);

const ERROR_CODES = ["content_too_large", "page_locked", "page_archived"] as const;

// Only a save's author and time, plus the name of a child page, may be copied onto the page.
const toPropertyUpdate = (data: unknown, isChildPage: boolean): EventToPayloadMap["property_updated"] => {
  const update: EventToPayloadMap["property_updated"] = {};
  const name = readString(data, "name");
  if (isChildPage && name !== undefined) update.name = name;
  const updatedAt = readString(data, "updated_at");
  if (updatedAt !== undefined) update.updated_at = updatedAt;
  const updatedBy = readField(data, "updated_by");
  if (typeof updatedBy === "string" || updatedBy === null) update.updated_by = updatedBy;
  return update;
};

// The message text is left out: the toast is built from the type and code alone.
const toError = (data: unknown): EventToPayloadMap["error"] | null => {
  const errorType = readString(data, "error_type");
  if (errorType !== "fetch" && errorType !== "store") return null;
  const code = readString(data, "error_code");
  return { error_message: "", error_type: errorType, error_code: ERROR_CODES.find((value) => value === code) };
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
  const pageId = readString(affectedPages, "currentPage");
  const parentPageId = readString(affectedPages, "parentPage") || null;
  const data = readField(message, "data");
  if (!pageId || !isRecord(data)) return null;

  const action = readString(message, "action");
  if (action === "property_updated")
    return { pageId, parentPageId, action, data: toPropertyUpdate(data, parentPageId !== null) };
  if (action === "error") {
    const error = toError(data);
    return error ? { pageId, parentPageId, action, data: error } : null;
  }
  return null;
};
