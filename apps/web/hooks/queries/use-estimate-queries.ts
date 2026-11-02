// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { PROJECT_ESTIMATES, WORKSPACE_ESTIMATES } from "@plane/constants";
import { useProjectEstimates } from "@/hooks/store/estimates";
import type { TStoreQueryOptions, TStoreQueryState } from "./use-store-query";
import { useProjectStoreQuery, useStoreQuery } from "./use-store-query";

/** Loads the estimates of a project. The workspace list holds every project's estimates, so it answers this too. */
export const useProjectEstimatesQuery = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined,
  options?: Omit<TStoreQueryOptions, "coveredBy">
): TStoreQueryState => {
  const { getProjectEstimates } = useProjectEstimates();
  return useProjectStoreQuery(workspaceSlug, projectId, PROJECT_ESTIMATES, getProjectEstimates, {
    ...options,
    coveredBy: workspaceSlug ? WORKSPACE_ESTIMATES(workspaceSlug) : null,
  });
};

/** Loads the estimates of every project in a workspace. */
export const useWorkspaceEstimatesQuery = (workspaceSlug: string | undefined): TStoreQueryState => {
  const { getWorkspaceEstimates } = useProjectEstimates();
  return useStoreQuery(
    workspaceSlug ? WORKSPACE_ESTIMATES(workspaceSlug) : null,
    workspaceSlug ? () => getWorkspaceEstimates(workspaceSlug) : null
  );
};
