/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { readString } from "@plane/types";

/** Reads the `error` message the API puts in a failed response body. */
export const getApiErrorMessage = (error: unknown): string | undefined => readString(error, "error");
