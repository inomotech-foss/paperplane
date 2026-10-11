// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import useSWR from "swr";
// hooks
import { useIssueTypes } from "@/hooks/store/use-issue-types";
import { useMember } from "@/hooks/store/use-member";

const SWR_OPTIONS = { revalidateIfStale: false, revalidateOnFocus: false };

/** Loads the project's types for a type picker shown outside the project's own pages. */
export const useProjectIssueTypes = (workspaceSlug: string | undefined, projectId: string | null | undefined) => {
  const { fetchedMap, fetchProjectIssueTypes } = useIssueTypes();
  const canLoad = !!workspaceSlug && !!projectId;
  useSWR(
    canLoad && !fetchedMap[projectId] ? `PROJECT_ISSUE_TYPES_PICKER_${projectId}` : null,
    canLoad ? () => fetchProjectIssueTypes(workspaceSlug, projectId) : null,
    SWR_OPTIONS
  );
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
