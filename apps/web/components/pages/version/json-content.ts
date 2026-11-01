/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { JSONContent } from "@plane/types";
import { isObject } from "@plane/types";

const isOptionalString = (value: unknown): boolean => value === undefined || typeof value === "string";
const isOptionalRecord = (value: unknown): boolean => value === undefined || isObject(value);

const isMark = (value: unknown): boolean =>
  isObject(value) && typeof value.type === "string" && isOptionalRecord(value.attrs);

export const isJSONContent = (value: unknown): value is JSONContent =>
  isObject(value) &&
  isOptionalString(value.type) &&
  isOptionalString(value.text) &&
  isOptionalRecord(value.attrs) &&
  (value.content === undefined || (Array.isArray(value.content) && value.content.every(isJSONContent))) &&
  (value.marks === undefined || (Array.isArray(value.marks) && value.marks.every(isMark)));

/** A stored version body as editor JSON, or `undefined` when it is missing or malformed. */
export const toJSONContent = (value: unknown): JSONContent | undefined => (isJSONContent(value) ? value : undefined);
