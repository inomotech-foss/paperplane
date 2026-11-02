// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { PROJECT_VIEWS } from "@plane/constants";
import { useProjectView } from "@/hooks/store/use-project-view";
import type { TStoreQueryState } from "./use-store-query";
import { useProjectStoreQuery } from "./use-store-query";

/** Loads the views of a project into the project view store. */
export const useProjectViews = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined
): TStoreQueryState => {
  const { fetchViews } = useProjectView();
  return useProjectStoreQuery(workspaceSlug, projectId, PROJECT_VIEWS, fetchViews);
};
