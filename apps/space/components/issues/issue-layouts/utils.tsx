/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// types
import { EIconSize, ISSUE_PRIORITIES } from "@plane/constants";
import { CycleGroupIcon, PriorityIcon, StateGroupIcon } from "@plane/blocks/icons";
import { CyclesOutline, ModuleOutline } from "@makeplane/propel/icons";
import type { IGroupByColumn, TIssueGroupByOptions } from "@plane/types";
// ui
import { Avatar } from "@makeplane/propel/components/avatar";
// components
// constants
// stores
import type { ICycleStore } from "@/store/cycle.store";
import type { IIssueLabelStore } from "@/store/label.store";
import type { IIssueMemberStore } from "@/store/members.store";
import type { IIssueModuleStore } from "@/store/module.store";
import type { IStateStore } from "@/store/state.store";

export const HIGHLIGHT_CLASS = "highlight";
export const HIGHLIGHT_WITH_LINE = "highlight-with-line";

export const getGroupByColumns = (
  groupBy: TIssueGroupByOptions | undefined,
  cycle: ICycleStore,
  module: IIssueModuleStore,
  label: IIssueLabelStore,
  projectState: IStateStore,
  member: IIssueMemberStore,
  includeNone?: boolean
): IGroupByColumn[] | undefined => {
  switch (groupBy) {
    case "cycle":
      return getCycleColumns(cycle);
    case "module":
      return getModuleColumns(module);
    case "state":
      return getStateColumns(projectState);
    case "priority":
      return getPriorityColumns();
    case "labels":
      return getLabelsColumns(label);
    case "assignees":
      return getAssigneeColumns(member);
    case "created_by":
      return getCreatedByColumns(member);
    default:
      if (includeNone) return [{ id: `All Issues`, name: `All work items`, payload: {}, icon: undefined }];
  }
};

const getCycleColumns = (cycleStore: ICycleStore): IGroupByColumn[] | undefined => {
  const { cycles } = cycleStore;

  if (!cycles) return;

  const cycleGroups: IGroupByColumn[] = [];

  cycles.map((cycle) => {
    if (cycle) {
      cycleGroups.push({
        id: cycle.id,
        name: cycle.name,
        icon: <CycleGroupIcon cycleGroup="draft" className="h-3.5 w-3.5" />,
        payload: { cycle_id: cycle.id },
      });
    }
  });
  cycleGroups.push({
    id: "None",
    name: "None",
    icon: <CyclesOutline className="h-3.5 w-3.5" />,
    payload: { cycle_id: null },
  });

  return cycleGroups;
};

const getModuleColumns = (moduleStore: IIssueModuleStore): IGroupByColumn[] | undefined => {
  const { modules } = moduleStore;

  if (!modules) return;

  const moduleGroups: IGroupByColumn[] = [];

  for (const moduleInfo of modules) {
    moduleGroups.push({
      id: moduleInfo.id,
      name: moduleInfo.name,
      icon: <ModuleOutline className="h-3.5 w-3.5" />,
      payload: { module_ids: [moduleInfo.id] },
    });
  }
  moduleGroups.push({
    id: "None",
    name: "None",
    icon: <ModuleOutline className="h-3.5 w-3.5" />,
    payload: { module_ids: [] },
  });

  return moduleGroups;
};

const getStateColumns = (projectState: IStateStore): IGroupByColumn[] | undefined => {
  const { sortedStates } = projectState;
  if (!sortedStates) return;

  return sortedStates.map((state) => ({
    id: state.id,
    name: state.name,
    icon: (
      <div className="h-3.5 w-3.5 rounded-full">
        <StateGroupIcon stateGroup={state.group} color={state.color} size={EIconSize.MD} />
      </div>
    ),
    payload: { state_id: state.id },
  }));
};

const getPriorityColumns = () => {
  const priorities = ISSUE_PRIORITIES;

  return priorities.map((priority) => ({
    id: priority.key,
    name: priority.title,
    icon: <PriorityIcon priority={priority?.key} />,
    payload: { priority: priority.key },
  }));
};

const getLabelsColumns = (label: IIssueLabelStore): IGroupByColumn[] | undefined => {
  const { labels: storeLabels } = label;

  if (!storeLabels) return;

  const labels = [...storeLabels, { id: "None", name: "None", color: "#666" }];

  return labels.map((label) => ({
    id: label.id,
    name: label.name,
    icon: (
      <div className="h-[12px] w-[12px] rounded-full" style={{ backgroundColor: label.color ? label.color : "#666" }} />
    ),
    payload: label?.id === "None" ? {} : { label_ids: [label.id] },
  }));
};

const getAssigneeColumns = (member: IIssueMemberStore): IGroupByColumn[] | undefined => {
  const { members } = member;

  if (!members) return;

  const assigneeColumns: IGroupByColumn[] = members.map((member) => ({
    id: member.id,
    name: member?.member__display_name || "",
    icon: (
      <Avatar
        size="xs"
        alt={member?.member__display_name}
        fallback={member?.member__display_name?.[0]?.toUpperCase()}
      />
    ),
    payload: { assignee_ids: [member.id] },
  }));

  assigneeColumns.push({ id: "None", name: "None", icon: <Avatar size="xs" />, payload: {} });

  return assigneeColumns;
};

const getCreatedByColumns = (member: IIssueMemberStore): IGroupByColumn[] | undefined => {
  const { members } = member;

  if (!members) return;

  return members.map((member) => ({
    id: member.id,
    name: member?.member__display_name || "",
    icon: (
      <Avatar
        size="xs"
        alt={member?.member__display_name}
        fallback={member?.member__display_name?.[0]?.toUpperCase()}
      />
    ),
    payload: {},
  }));
};

export const getIssueBlockId = (issueId: string | undefined, groupId: string | undefined, subGroupId?: string) =>
  `issue_${issueId}_${groupId}_${subGroupId}`;
