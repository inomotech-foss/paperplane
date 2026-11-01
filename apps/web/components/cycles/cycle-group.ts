/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TCycleGroups } from "@plane/types";
import { findLiteral } from "@plane/types";

const CYCLE_GROUPS = ["current", "upcoming", "completed", "draft"] as const satisfies readonly TCycleGroups[];

/** Maps the API cycle status to its group. Unknown values count as draft. */
export const getCycleGroup = (status: string | undefined): TCycleGroups =>
  (status && findLiteral(CYCLE_GROUPS, status.toLocaleLowerCase())) || "draft";
