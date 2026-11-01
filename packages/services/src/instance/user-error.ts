// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { readField } from "@plane/types";
import type { TInstanceUserError } from "@plane/types";
import { isApiError } from "../client";

/** The refusal body of a user lifecycle endpoint, or `undefined` when the error carries none. */
export function instanceUserError(error: unknown): TInstanceUserError | undefined {
  if (!isApiError(error) || error.error === undefined) return undefined;
  const owned = readField(error.data, "owned_workspaces");
  if (!Array.isArray(owned)) return { error: error.error };
  return { error: error.error, owned_workspaces: owned.filter((slug): slug is string => typeof slug === "string") };
}
