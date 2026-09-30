/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { EIconSize } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { StateGroupIcon } from "@plane/blocks/icons";
import type { TAutomationValueSource } from "@plane/types";
// local imports
import type { TAutomationOption } from "./option-select";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useLabel } from "@/hooks/store/use-label";
import { useMember } from "@/hooks/store/use-member";
import { useModule } from "@/hooks/store/use-module";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";

const STATE_GROUPS = ["backlog", "unstarted", "started", "completed", "cancelled"] as const;
const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;

/**
 * Turns a property's declared `source` into options for the value pickers.
 *
 * Everything is read from stores the settings page has already populated, so no
 * extra requests are made while the author builds a rule.
 *
 * ``projectId`` is optional: a workspace-scoped automation has no single project,
 * so member lookups fall back to the workspace roster and the project-local
 * sources return nothing. `helpers/metadata` hides properties backed by those
 * sources at workspace scope, so an empty picker should never be reachable — but
 * returning `[]` keeps this safe if one slips through.
 */
export const useValueOptions = (projectId?: string) => {
  const { t } = useTranslation();
  const { getProjectStates } = useProjectState();
  const { getProjectLabels } = useLabel();
  const { getProjectModuleIds, getModuleById } = useModule();
  const { getProjectCycleIds, getCycleById } = useCycle();
  const { getPartialProjectById, joinedProjectIds } = useProject();
  const {
    project: { getProjectMemberIds, getProjectMemberDetails },
    workspace: { workspaceMemberIds, getWorkspaceMemberDetails },
  } = useMember();

  const memberOptions = (): TAutomationOption[] => {
    if (projectId) {
      return (getProjectMemberIds(projectId, false) ?? []).flatMap((memberId) => {
        const details = getProjectMemberDetails(memberId, projectId);
        if (!details) return [];
        const name = details.member.display_name || details.member.email || memberId;
        return [{ value: memberId, query: name }];
      });
    }
    return (workspaceMemberIds ?? []).flatMap((memberId) => {
      const details = getWorkspaceMemberDetails(memberId);
      if (!details?.member) return [];
      const name = details.member.display_name || details.member.email || memberId;
      return [{ value: memberId, query: name }];
    });
  };

  const optionsFor = (source: TAutomationValueSource): TAutomationOption[] => {
    switch (source) {
      case "states":
        if (!projectId) return [];
        return (getProjectStates(projectId) ?? []).map((state) => ({
          value: state.id,
          query: state.name,
          icon: <StateGroupIcon stateGroup={state.group} color={state.color} size={EIconSize.SM} />,
        }));

      case "state_groups":
        return STATE_GROUPS.map((group) => ({
          value: group,
          query: t(`automations.state_groups.${group}`),
          icon: <StateGroupIcon stateGroup={group} size={EIconSize.SM} />,
        }));

      case "priorities":
        return PRIORITIES.map((priority) => ({
          value: priority,
          query: t(`automations.priorities.${priority}`),
        }));

      case "members":
        return memberOptions();

      case "labels":
        if (!projectId) return [];
        return (getProjectLabels(projectId) ?? []).map((label) => ({
          value: label.id,
          query: label.name,
          icon: <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />,
        }));

      case "modules":
        if (!projectId) return [];
        return (getProjectModuleIds(projectId) ?? []).flatMap((moduleId) => {
          const moduleDetails = getModuleById(moduleId);
          if (!moduleDetails) return [];
          return [
            {
              value: moduleId,
              query: moduleDetails.name,
            },
          ];
        });

      case "cycles":
        if (!projectId) return [];
        return (getProjectCycleIds(projectId) ?? []).flatMap((cycleId) => {
          const cycle = getCycleById(cycleId);
          if (!cycle) return [];
          return [{ value: cycleId, query: cycle.name }];
        });

      case "projects":
        return (joinedProjectIds ?? []).flatMap((id) => {
          const project = getPartialProjectById(id);
          if (!project) return [];
          return [{ value: id, query: project.name }];
        });

      default:
        return [];
    }
  };

  /** Human-readable label for a single stored value. */
  const labelFor = (source: TAutomationValueSource, value: string): string => {
    const match = optionsFor(source).find((option) => option.value === value);
    if (!match) return value;
    return match.query;
  };

  return { optionsFor, labelFor };
};
