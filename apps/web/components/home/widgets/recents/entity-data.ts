/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TActivityEntityData, TIssueEntityData, TPageEntityData, TProjectEntityData } from "@plane/types";

// the API may send no entity data for a deleted entity
type TEntityData = TActivityEntityData["entity_data"] | null | undefined;

export const isIssueEntityData = (data: TEntityData): data is TIssueEntityData => !!data && "sequence_id" in data;

export const isPageEntityData = (data: TEntityData): data is TPageEntityData => !!data && "owned_by" in data;

export const isProjectEntityData = (data: TEntityData): data is TProjectEntityData =>
  !!data && "identifier" in data && "project_members" in data;
