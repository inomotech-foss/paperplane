// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useCallback } from "react";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useIssueTypes } from "@/hooks/store/use-issue-types";
import { useLabel } from "@/hooks/store/use-label";
import { useMember } from "@/hooks/store/use-member";
import { useModule } from "@/hooks/store/use-module";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
// local imports
import type { ValuesFor } from "./vocabulary";

const unique = (names: (string | undefined | null)[]): string[] => [
  ...new Set(names.filter((name): name is string => !!name)),
];

/**
 * Entity names for value completion, read from the stores already loaded for
 * the list. A project-scoped bar reads that project; a workspace-scoped bar
 * reads the union of the projects the person has joined and loaded so far.
 */
export const useValuesFor = (projectId: string | undefined): ValuesFor => {
  const { getProjectStates, workspaceStates } = useProjectState();
  const { getProjectLabels, workspaceLabels } = useLabel();
  const { getUserDetails, project: projectMembers, workspace: workspaceMembers } = useMember();
  const { getProjectModuleIds, getModuleById } = useModule();
  const { getProjectCycleIds, getCycleById } = useCycle();
  const { getProjectIssueTypes } = useIssueTypes();
  const { joinedProjectIds, workspaceProjectIds, getProjectById } = useProject();

  return useCallback(
    async (field: string) => {
      const projectIds = projectId ? [projectId] : joinedProjectIds;
      switch (field) {
        case "state_id":
          return unique((projectId ? getProjectStates(projectId) : workspaceStates)?.map((state) => state.name) ?? []);
        case "labels__id":
          return unique((projectId ? getProjectLabels(projectId) : workspaceLabels)?.map((label) => label.name) ?? []);
        case "assignees__id":
        case "created_by": {
          const ids = projectId
            ? projectMembers.getProjectMemberIds(projectId, true)
            : workspaceMembers.workspaceMemberIds;
          return unique((ids ?? []).map((id) => getUserDetails(id)?.display_name));
        }
        case "issue_module__module_id":
          return unique(
            projectIds.flatMap((id) => (getProjectModuleIds(id) ?? []).map((moduleId) => getModuleById(moduleId)?.name))
          );
        case "cycle_id":
          return unique(
            projectIds.flatMap((id) => (getProjectCycleIds(id) ?? []).map((cycleId) => getCycleById(cycleId)?.name))
          );
        case "type_id":
          return unique(projectIds.flatMap((id) => (getProjectIssueTypes(id) ?? []).map((type) => type.name)));
        case "project_id":
          return unique((workspaceProjectIds ?? []).map((id) => getProjectById(id)?.identifier));
        default:
          return [];
      }
    },
    [
      projectId,
      joinedProjectIds,
      workspaceProjectIds,
      getProjectStates,
      workspaceStates,
      getProjectLabels,
      workspaceLabels,
      projectMembers,
      workspaceMembers,
      getUserDetails,
      getProjectModuleIds,
      getModuleById,
      getProjectCycleIds,
      getCycleById,
      getProjectIssueTypes,
      getProjectById,
    ]
  );
};
