/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Reads the `error` message the API puts in a failed response body. */
export const getApiErrorMessage = (error: unknown): string | undefined =>
  isRecord(error) && typeof error.error === "string" ? error.error : undefined;
