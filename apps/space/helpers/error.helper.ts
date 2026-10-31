/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isApiError } from "@plane/services";
import { getField } from "./narrow.helper";

/** Reads a field from the body of a failed API response. */
export const getApiErrorField = (error: unknown, key: string): unknown =>
  isApiError(error) ? getField(error.data, key) : undefined;
