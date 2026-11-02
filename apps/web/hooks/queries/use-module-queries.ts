// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { PROJECT_MODULES, WORKSPACE_MODULES } from "@plane/constants";
import { useModule } from "@/hooks/store/use-module";
import type { TStoreQueryOptions, TStoreQueryState } from "./use-store-query";
import { useProjectStoreQuery, useStoreQuery } from "./use-store-query";

/** Loads every module of a project into the module store. */
export const useProjectModules = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined,
  options?: TStoreQueryOptions
): TStoreQueryState => {
  const { fetchModules } = useModule();
  return useProjectStoreQuery(workspaceSlug, projectId, PROJECT_MODULES, fetchModules, options);
};

/** Loads the archived modules of a project into the module store. */
export const useArchivedModules = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined
): TStoreQueryState => {
  const { fetchArchivedModules } = useModule();
  return useStoreQuery(
    workspaceSlug && projectId ? `ARCHIVED_MODULES_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId ? () => fetchArchivedModules(workspaceSlug, projectId) : null
  );
};

/** Loads the slim module list of all projects. It does not make any project's list complete. */
export const useWorkspaceModules = (workspaceSlug: string | undefined): TStoreQueryState => {
  const { fetchWorkspaceModules } = useModule();
  return useStoreQuery(
    workspaceSlug ? WORKSPACE_MODULES(workspaceSlug) : null,
    workspaceSlug ? () => fetchWorkspaceModules(workspaceSlug) : null
  );
};
