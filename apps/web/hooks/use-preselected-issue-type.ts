// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import useSWR from "swr";
// hooks
import { useIssueTypes } from "@/hooks/store/use-issue-types";
import { useMember } from "@/hooks/store/use-member";

const SWR_OPTIONS = { revalidateIfStale: false, revalidateOnFocus: false };

/**
 * The type a new work item of the project starts with. Loads the project's types and the user's project
 * preferences when a create form opens outside the project's own pages.
 */
export const usePreselectedIssueTypeId = (
  workspaceSlug: string | undefined,
  projectId: string | null | undefined
): string | undefined => {
  const { fetchedMap, fetchProjectIssueTypes, getPreselectedIssueTypeId } = useIssueTypes();
  const {
    project: { getProjectUserProperties, fetchProjectUserProperties },
  } = useMember();
  const canLoad = !!workspaceSlug && !!projectId;

  useSWR(
    canLoad && !fetchedMap[projectId] ? `PRESELECT_ISSUE_TYPES_${projectId}` : null,
    canLoad ? () => fetchProjectIssueTypes(workspaceSlug, projectId) : null,
    SWR_OPTIONS
  );
  useSWR(
    canLoad && !getProjectUserProperties(projectId) ? `PRESELECT_USER_PROPERTIES_${projectId}` : null,
    canLoad ? () => fetchProjectUserProperties(workspaceSlug, projectId) : null,
    SWR_OPTIONS
  );

  return getPreselectedIssueTypeId(projectId);
};
