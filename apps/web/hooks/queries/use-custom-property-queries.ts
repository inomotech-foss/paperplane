// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { PROJECT_CUSTOM_PROPERTIES } from "@plane/constants";
import { useIssueCustomProperties } from "@/hooks/store/use-issue-custom-properties";
import type { TStoreQueryState } from "./use-store-query";
import { useProjectStoreQuery } from "./use-store-query";

/** Loads the custom properties of a project into the custom property store. */
export const useProjectCustomProperties = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined
): TStoreQueryState => {
  const { fetchProjectProperties } = useIssueCustomProperties();
  return useProjectStoreQuery(workspaceSlug, projectId, PROJECT_CUSTOM_PROPERTIES, fetchProjectProperties);
};
