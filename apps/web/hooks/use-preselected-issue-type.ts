// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import useSWR from "swr";
import { PROJECT_ISSUE_TYPES } from "@plane/constants";
// hooks
import type { TStoreQueryState } from "@/hooks/queries/use-store-query";
import { useProjectStoreQuery } from "@/hooks/queries/use-store-query";
import { useIssueTypes } from "@/hooks/store/use-issue-types";
import { useMember } from "@/hooks/store/use-member";

const SWR_OPTIONS = { revalidateIfStale: false, revalidateOnFocus: false };

/** Loads the work item types of a project into the issue type store. */
export const useProjectIssueTypes = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined
): TStoreQueryState => {
  const { fetchProjectIssueTypes } = useIssueTypes();
  return useProjectStoreQuery(workspaceSlug, projectId, PROJECT_ISSUE_TYPES, fetchProjectIssueTypes);
};

/**
 * The type a new work item of the project starts with. Loads the project's types and the user's project
 * preferences when a create form opens outside the project's own pages.
 */
export const usePreselectedIssueTypeId = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined
): string | undefined => {
  const { getPreselectedIssueTypeId } = useIssueTypes();
  const {
    project: { getProjectUserProperties, fetchProjectUserProperties },
  } = useMember();
  const canLoad = !!workspaceSlug && !!projectId;

  useProjectIssueTypes(workspaceSlug, projectId);
  useSWR(
    canLoad && !getProjectUserProperties(projectId) ? `PRESELECT_USER_PROPERTIES_${projectId}` : null,
    canLoad ? () => fetchProjectUserProperties(workspaceSlug, projectId) : null,
    SWR_OPTIONS
  );

  return getPreselectedIssueTypeId(projectId);
};
