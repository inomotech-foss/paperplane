/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { EUserPermissions } from "@plane/types";

type TIssueKeyParams = {
  state?: string;
  state_group?: string;
  priority?: string;
  mentions?: string;
  assignees?: string;
  created_by?: string;
  labels?: string;
  start_date?: string;
  target_date?: string;
  sub_issue?: boolean | string;
  project?: string;
  layout?: string;
  subscriber?: string;
  type?: string;
  group_by?: string;
  order_by?: string;
};

const sortedKey = (value: string | undefined) => (value ? value.split(",").toSorted().join("_") : "");

const paramsToKey = (params: TIssueKeyParams) => {
  const { start_date, target_date, sub_issue, layout } = params;

  const projectKey = sortedKey(params.project);
  const stateKey = sortedKey(params.state);
  const stateGroupKey = sortedKey(params.state_group);
  const priorityKey = sortedKey(params.priority);
  const assigneesKey = sortedKey(params.assignees);
  const mentionsKey = sortedKey(params.mentions);
  const createdByKey = sortedKey(params.created_by);
  const labelsKey = sortedKey(params.labels);
  const subscriberKey = sortedKey(params.subscriber);
  const startDateKey = start_date ?? "";
  const targetDateKey = target_date ?? "";
  const type = params.type ? params.type.toUpperCase() : "NULL";
  const groupBy = params.group_by ? params.group_by.toUpperCase() : "NULL";
  const orderBy = params.order_by ? params.order_by.toUpperCase() : "NULL";
  const layoutKey = layout ? layout.toUpperCase() : "";

  return `${layoutKey}_${projectKey}_${stateGroupKey}_${stateKey}_${priorityKey}_${assigneesKey}_${mentionsKey}_${createdByKey}_${type}_${groupBy}_${orderBy}_${labelsKey}_${startDateKey}_${targetDateKey}_${sub_issue}_${subscriberKey}`;
};

export const USER_WORKSPACES_LIST = "USER_WORKSPACES_LIST";

export const WORKSPACE_PARTIAL_PROJECTS = (workspaceSlug: string) =>
  `WORKSPACE_PARTIAL_PROJECTS_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_PROJECT_LINKS = (workspaceSlug: string) =>
  `WORKSPACE_PROJECT_LINKS_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_MEMBERS = (workspaceSlug: string) => `WORKSPACE_MEMBERS_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_MODULES = (workspaceSlug: string) => `WORKSPACE_MODULES_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_CYCLES = (workspaceSlug: string) => `WORKSPACE_CYCLES_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_LABELS = (workspaceSlug: string) => `WORKSPACE_LABELS_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_ESTIMATES = (workspaceSlug: string) => `WORKSPACE_ESTIMATES_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_WORKFLOW_STATES = (workspaceSlug: string) =>
  `WORKSPACE_WORKFLOW_STATES_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_INVITATION = (invitationId: string) => `WORKSPACE_INVITATION_${invitationId}`;

export const WORKSPACE_MEMBER_ME_INFORMATION = (workspaceSlug: string) =>
  `WORKSPACE_MEMBER_ME_INFORMATION_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_MEMBER_ACTIVITY = (workspaceSlug: string) =>
  `WORKSPACE_MEMBER_ACTIVITY_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_PROJECTS_ROLES_INFORMATION = (workspaceSlug: string) =>
  `WORKSPACE_PROJECTS_ROLES_INFORMATION_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_FAVORITE = (workspaceSlug: string) => `WORKSPACE_FAVORITE_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_STATES = (workspaceSlug: string) => `WORKSPACE_STATES_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_SIDEBAR_PREFERENCES = (workspaceSlug: string) =>
  `WORKSPACE_SIDEBAR_PREFERENCES_${workspaceSlug.toUpperCase()}`;

export const WORKSPACE_PROJECT_NAVIGATION_PREFERENCES = (workspaceSlug: string) =>
  `WORKSPACE_PROJECT_NAVIGATION_PREFERENCES_${workspaceSlug.toUpperCase()}`;

// cycles
export const WORKSPACE_ACTIVE_CYCLES_LIST = (workspaceSlug: string, cursor: string, per_page: string) =>
  `WORKSPACE_ACTIVE_CYCLES_LIST_${workspaceSlug.toUpperCase()}_${cursor.toUpperCase()}_${per_page.toUpperCase()}`;
export const CYCLE_ISSUES_WITH_PARAMS = (cycleId: string, params?: TIssueKeyParams) => {
  if (!params) return `CYCLE_ISSUES_WITH_PARAMS_${cycleId.toUpperCase()}`;

  const paramsKey = paramsToKey(params);

  return `CYCLE_ISSUES_WITH_PARAMS_${cycleId.toUpperCase()}_${paramsKey.toUpperCase()}`;
};

export const USER_ACTIVITY = (params: { cursor?: string }) => `USER_ACTIVITY_${params?.cursor}`;

// Issues
export const ISSUE_DETAILS = (issueId: string) => `ISSUE_DETAILS_${issueId.toUpperCase()}`;

//export
export const EXPORT_SERVICES_LIST = (workspaceSlug: string, cursor: string, per_page: string) =>
  `EXPORTER_SERVICES_LIST_${workspaceSlug.toUpperCase()}_${cursor.toUpperCase()}_${per_page.toUpperCase()}`;

// profile
export const USER_PROFILE_DATA = (workspaceSlug: string, userId: string) =>
  `USER_PROFILE_ACTIVITY_${workspaceSlug.toUpperCase()}_${userId.toUpperCase()}`;
export const USER_PROFILE_ACTIVITY = (
  workspaceSlug: string,
  userId: string,
  params: {
    cursor?: string;
  }
) => `USER_WORKSPACE_PROFILE_ACTIVITY_${workspaceSlug.toUpperCase()}_${userId.toUpperCase()}_${params?.cursor}`;
export const USER_PROFILE_PROJECT_SEGREGATION = (workspaceSlug: string, userId: string) =>
  `USER_PROFILE_PROJECT_SEGREGATION_${workspaceSlug.toUpperCase()}_${userId.toUpperCase()}`;

// api-tokens
export const API_TOKENS_LIST = `API_TOKENS_LIST`;
export const CONNECTED_APPS_LIST = `CONNECTED_APPS_LIST`;

// marketplace
export const APPLICATIONS_LIST = (workspaceSlug: string) => `APPLICATIONS_LIST_${workspaceSlug.toUpperCase()}`;
export const APPLICATION_DETAILS = (applicationId: string) => `APPLICATION_DETAILS_${applicationId.toUpperCase()}`;
export const APPLICATION_BY_CLIENT_ID = (clientId: string) => `APPLICATION_BY_CLIENT_ID_${clientId.toUpperCase()}`;
export const APPLICATION_CATEGORIES_LIST = () => `APPLICATION_CATEGORIES_LIST`;

// project level keys
export const PROJECT_DETAILS = (_workspaceSlug: string, projectId: string) =>
  `PROJECT_DETAILS_${projectId.toString().toUpperCase()}`;

export const PROJECT_ME_INFORMATION = (_workspaceSlug: string, projectId: string) =>
  `PROJECT_ME_INFORMATION_${projectId.toString().toUpperCase()}`;

export const PROJECT_LABELS = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_LABELS_${projectId.toString().toUpperCase()}_${projectRole}`;
export const PROJECT_CUSTOM_PROPERTIES = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_CUSTOM_PROPERTIES_${projectId.toString().toUpperCase()}_${projectRole}`;
export const PROJECT_CUSTOM_PROPERTY_VALUES = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_CUSTOM_PROPERTY_VALUES_${projectId.toString().toUpperCase()}_${projectRole}`;
export const PROJECT_ISSUE_TYPES = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_ISSUE_TYPES_${projectId.toString().toUpperCase()}_${projectRole}`;

export const PROJECT_MEMBERS = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_MEMBERS_${projectId.toString().toUpperCase()}_${projectRole}`;

export const PROJECT_STATES = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_STATES_${projectId.toString().toUpperCase()}_${projectRole}`;

export const PROJECT_INTAKE_STATE = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_INTAKE_STATE_${projectId.toString().toUpperCase()}_${projectRole}`;

export const PROJECT_ESTIMATES = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_ESTIMATES_${projectId.toString().toUpperCase()}_${projectRole}`;

export const PROJECT_ALL_CYCLES = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_ALL_CYCLES_${projectId.toString().toUpperCase()}_${projectRole}`;

export const PROJECT_MODULES = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_MODULES_${projectId.toString().toUpperCase()}_${projectRole}`;

export const PROJECT_VIEWS = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_VIEWS_${projectId.toString().toUpperCase()}_${projectRole}`;

export const PROJECT_MEMBER_PREFERENCES = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_MEMBER_PREFERENCES_${projectId.toString().toUpperCase()}_${projectRole}`;

export const PROJECT_WORKFLOWS = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_WORKFLOWS_${projectId.toString().toUpperCase()}_${projectRole}`;

export const WORK_ITEM_TYPES_PROPERTIES_AND_OPTIONS = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `WORK_ITEM_TYPES_PROPERTIES_AND_OPTIONS_${projectId.toString().toUpperCase()}_${projectRole}`;

export const PROJECT_MILESTONES = (projectId: string, projectRole: EUserPermissions | undefined) =>
  `PROJECT_MILESTONES_${projectId.toString().toUpperCase()}_${projectRole}`;
