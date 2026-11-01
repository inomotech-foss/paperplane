/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FieldError, FieldValues } from "react-hook-form";
import { isObject, isRecord } from "@plane/types";

const getChild = (value: unknown, key: string): unknown =>
  isObject(value) ? Object.entries(value).find(([childKey]) => childKey === key)?.[1] : undefined;

const isFieldError = (value: unknown): value is FieldError =>
  isRecord(value) && "message" in value && typeof value.type === "string";

/**
 * Get a nested error from a form's errors object
 * @param errors - The form's errors object
 * @param path - The path to the error
 * @returns The error or undefined if not found
 */
export const getNestedError = <T extends FieldValues>(errors: T, path: string): FieldError | undefined => {
  const keys = path.split(".");
  let current: unknown = errors;

  for (const key of keys) {
    current = getChild(current, key);
    if (current === undefined) return undefined;
  }

  return isFieldError(current) ? current : undefined;
};
