/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TInstanceUserError } from "@plane/types";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Reads the `error` message the API puts in a failed response body. */
export const getApiErrorMessage = (error: unknown): string | undefined =>
  isRecord(error) && typeof error.error === "string" ? error.error : undefined;

export const isInstanceUserError = (error: unknown): error is TInstanceUserError =>
  isRecord(error) &&
  typeof error.error === "string" &&
  (error.owned_workspaces === undefined ||
    (Array.isArray(error.owned_workspaces) &&
      error.owned_workspaces.every((slug: unknown) => typeof slug === "string")));
