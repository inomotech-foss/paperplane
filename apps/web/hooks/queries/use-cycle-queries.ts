// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { PROJECT_ALL_CYCLES, WORKSPACE_CYCLES } from "@plane/constants";
import { useCycle } from "@/hooks/store/use-cycle";
import type { TStoreQueryOptions, TStoreQueryState } from "./use-store-query";
import { useProjectStoreQuery, useStoreQuery } from "./use-store-query";

/** Loads every cycle of a project into the cycle store. */
export const useProjectCycles = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined,
  options?: TStoreQueryOptions
): TStoreQueryState => {
  const { fetchAllCycles } = useCycle();
  return useProjectStoreQuery(workspaceSlug, projectId, PROJECT_ALL_CYCLES, fetchAllCycles, options);
};

/** Loads the archived cycles of a project into the cycle store. */
export const useArchivedCycles = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined
): TStoreQueryState => {
  const { fetchArchivedCycles } = useCycle();
  return useStoreQuery(
    workspaceSlug && projectId ? `ARCHIVED_CYCLES_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId ? () => fetchArchivedCycles(workspaceSlug, projectId) : null
  );
};

/** Loads the slim cycle list of all projects. It does not make any project's list complete. */
export const useWorkspaceCycles = (workspaceSlug: string | undefined): TStoreQueryState => {
  const { fetchWorkspaceCycles } = useCycle();
  return useStoreQuery(
    workspaceSlug ? WORKSPACE_CYCLES(workspaceSlug) : null,
    workspaceSlug ? () => fetchWorkspaceCycles(workspaceSlug) : null
  );
};
