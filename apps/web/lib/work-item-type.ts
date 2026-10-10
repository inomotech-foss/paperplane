// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TIssueType } from "@plane/types";

/** The type a new work item starts with: the one used last if it is still available, else the first. */
export const pickIssueTypeId = (
  types: Pick<TIssueType, "id">[] | undefined,
  lastUsedTypeId: string | undefined
): string | undefined => types?.find((type) => type.id === lastUsedTypeId)?.id ?? types?.[0]?.id;
