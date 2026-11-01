/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { readField } from "@plane/types";

// Tiptap's HTML parser turns all-digit attribute values into numbers.
export const readText = (value: unknown, key: string): string | undefined => {
  const property = readField(value, key);
  if (typeof property === "number" && Number.isFinite(property)) return String(property);
  return typeof property === "string" ? property : undefined;
};
