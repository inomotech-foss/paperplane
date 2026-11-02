// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { PROJECT_LABELS, WORKSPACE_LABELS } from "@plane/constants";
import { useLabel } from "@/hooks/store/use-label";
import type { TStoreQueryOptions, TStoreQueryState } from "./use-store-query";
import { useProjectStoreQuery, useStoreQuery } from "./use-store-query";

/** Loads the labels of a project. The workspace list holds every project's labels, so it answers this too. */
export const useProjectLabels = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined,
  options?: Omit<TStoreQueryOptions, "coveredBy">
): TStoreQueryState => {
  const { fetchProjectLabels } = useLabel();
  return useProjectStoreQuery(workspaceSlug, projectId, PROJECT_LABELS, fetchProjectLabels, {
    ...options,
    coveredBy: workspaceSlug ? WORKSPACE_LABELS(workspaceSlug) : null,
  });
};

/** Loads the labels of every project in a workspace. */
export const useWorkspaceLabels = (
  workspaceSlug: string | undefined,
  options?: Omit<TStoreQueryOptions, "coveredBy">
): TStoreQueryState => {
  const { fetchWorkspaceLabels } = useLabel();
  return useStoreQuery(
    workspaceSlug ? WORKSPACE_LABELS(workspaceSlug) : null,
    workspaceSlug ? () => fetchWorkspaceLabels(workspaceSlug) : null,
    options
  );
};
