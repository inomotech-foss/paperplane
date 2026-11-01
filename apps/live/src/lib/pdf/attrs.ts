/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isNumberArray, readField } from "@plane/types";

export const attrNumberArray = (attrs: Record<string, unknown> | undefined, key: string): number[] | undefined => {
  const value = readField(attrs, key);
  return isNumberArray(value) ? value : undefined;
};
