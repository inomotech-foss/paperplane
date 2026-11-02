// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { PROJECT_STATES, WORKSPACE_STATES } from "@plane/constants";
import { useProjectState } from "@/hooks/store/use-project-state";
import type { TStoreQueryOptions, TStoreQueryState } from "./use-store-query";
import { useProjectStoreQuery, useStoreQuery } from "./use-store-query";

/** Loads the states of a project. The workspace list holds every project's states, so it answers this too. */
export const useProjectStates = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined,
  options?: Omit<TStoreQueryOptions, "coveredBy">
): TStoreQueryState => {
  const { fetchProjectStates } = useProjectState();
  return useProjectStoreQuery(workspaceSlug, projectId, PROJECT_STATES, fetchProjectStates, {
    ...options,
    coveredBy: workspaceSlug ? WORKSPACE_STATES(workspaceSlug) : null,
  });
};

/** Loads the states of every project in a workspace. */
export const useWorkspaceStates = (workspaceSlug: string | undefined): TStoreQueryState => {
  const { fetchWorkspaceStates } = useProjectState();
  return useStoreQuery(
    workspaceSlug ? WORKSPACE_STATES(workspaceSlug) : null,
    workspaceSlug ? () => fetchWorkspaceStates(workspaceSlug) : null
  );
};
