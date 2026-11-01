/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { JSONContent } from "@plane/types";
import { isObject } from "@plane/types";

const isOptionalString = (value: unknown): boolean => value === undefined || typeof value === "string";
const isOptionalRecord = (value: unknown): boolean => value === undefined || isObject(value);

const fieldOf = (value: object, key: string): unknown => Reflect.get(value, key);

const isMark = (value: unknown): boolean =>
  isObject(value) && typeof fieldOf(value, "type") === "string" && isOptionalRecord(fieldOf(value, "attrs"));

export const isJSONContent = (value: unknown): value is JSONContent => {
  if (!isObject(value)) return false;
  const content = fieldOf(value, "content");
  const marks = fieldOf(value, "marks");
  return (
    isOptionalString(fieldOf(value, "type")) &&
    isOptionalString(fieldOf(value, "text")) &&
    isOptionalRecord(fieldOf(value, "attrs")) &&
    (content === undefined || (Array.isArray(content) && content.every(isJSONContent))) &&
    (marks === undefined || (Array.isArray(marks) && marks.every(isMark)))
  );
};

/** A stored version body as editor JSON, or `undefined` when it is missing or malformed. */
export const toJSONContent = (value: unknown): JSONContent | undefined => (isJSONContent(value) ? value : undefined);
