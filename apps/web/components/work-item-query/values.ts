// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useCallback } from "react";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useIssueCustomProperties } from "@/hooks/store/use-issue-custom-properties";
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
 * The stores are read when completion asks, so the callback only changes with the project.
 */
export const useValuesFor = (projectId: string | undefined): ValuesFor => {
  const states = useProjectState();
  const labels = useLabel();
  const members = useMember();
  const modules = useModule();
  const cycles = useCycle();
  const types = useIssueTypes();
  const projects = useProject();
  const properties = useIssueCustomProperties();

  return useCallback(
    async (field: string) => {
      const projectIds = projectId ? [projectId] : projects.joinedProjectIds;
      switch (field) {
        case "state_id":
          return unique(
            (projectId ? states.getProjectStates(projectId) : states.workspaceStates)?.map((state) => state.name) ?? []
          );
        case "labels__id":
          return unique(
            (projectId ? labels.getProjectLabels(projectId) : labels.workspaceLabels)?.map((label) => label.name) ?? []
          );
        case "assignees__id":
        case "created_by": {
          const ids = projectId
            ? members.project.getProjectMemberIds(projectId, true)
            : members.workspace.workspaceMemberIds;
          return unique((ids ?? []).map((id) => members.getUserDetails(id)?.display_name));
        }
        case "issue_module__module_id":
          return unique(
            projectIds.flatMap((id) =>
              (modules.getProjectModuleIds(id) ?? []).map((moduleId) => modules.getModuleById(moduleId)?.name)
            )
          );
        case "cycle_id":
          return unique(
            projectIds.flatMap((id) =>
              (cycles.getProjectCycleIds(id) ?? []).map((cycleId) => cycles.getCycleById(cycleId)?.name)
            )
          );
        case "type_id":
          return unique(projectIds.flatMap((id) => (types.getProjectIssueTypes(id) ?? []).map((type) => type.name)));
        case "project_id":
          return unique(projects.joinedProjectIds.map((id) => projects.getProjectById(id)?.identifier));
        case "cf":
          if (!projectId) return [];
          return unique((properties.getProjectProperties(projectId) ?? []).map((property) => property.display_name));
        default:
          return [];
      }
    },
    [projectId, states, labels, members, modules, cycles, types, projects, properties]
  );
};
