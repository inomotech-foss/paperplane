/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import type { ICycle } from "./cycle";
import type { TIssue } from "./issues/issue";
import type { TLinkMetadata } from "./issues/issue_link";
import type { IModule } from "./module";
import type { TStateGroups } from "./state";
import type {
  IIssueDisplayProperties,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
  TTimelineColorBy,
} from "./client-json";
import type { TIssueExtraOptions, TIssueGroupingFilters } from "./view-props";

export interface IIssueCycle {
  id: string;
  cycle_detail: ICycle;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
  project: string;
  workspace: string;
  issue: string;
  cycle: string;
}

export interface IIssueModule {
  created_at: Date;
  created_by: string;
  id: string;
  issue: string;
  module: string;
  module_detail: IModule;
  project: string;
  updated_at: Date;
  updated_by: string;
  workspace: string;
}

export interface ILinkDetails {
  created_at: Date;
  created_by: string;
  id: string;
  metadata: TLinkMetadata;
  title: string;
  url: string;
}

export interface ISubIssueResponse {
  state_distribution: Record<TStateGroups, number>;
  sub_issues: TIssue[];
}

export interface IIssueLabel {
  id: string;
  name: string;
  color: string;
  project_id: string | null;
  workspace_id: string;
  parent: string | null;
  sort_order: number;
}

export interface IIssueLabelTree extends IIssueLabel {
  children: IIssueLabel[] | undefined;
}

/** A work item activity row as the activity endpoints return it. */
export type IIssueActivity = ApiSchema<"IssueActivity">;

export type TIssuePriorities = "urgent" | "high" | "medium" | "low" | "none";

export interface ViewFlags {
  enableQuickAdd: boolean;
  enableIssueCreation: boolean;
  enableInlineEditing: boolean;
}

export type GroupByColumnTypes =
  | "project"
  | "cycle"
  | "module"
  | "state"
  | "state_detail.group"
  | "priority"
  | "labels"
  | "assignees"
  | "created_by"
  | "team_project";

export type TGetColumns = {
  isWorkspaceLevel?: boolean;
  projectId?: string;
};

export interface IGroupByColumn {
  id: string;
  name: string;
  icon?: React.ReactElement | undefined;
  payload: Partial<TIssue>;
  isDropDisabled?: boolean;
  dropErrorMessage?: string;
}

export interface IIssueMap {
  [key: string]: TIssue;
}

export interface ILayoutDisplayFiltersOptions {
  display_properties: (keyof IIssueDisplayProperties)[];
  display_filters: {
    group_by?: TIssueGroupByOptions[];
    sub_group_by?: TIssueGroupByOptions[];
    order_by?: TIssueOrderByOptions[];
    type?: TIssueGroupingFilters[];
    color_by?: TTimelineColorBy[];
  };
  extra_options: {
    access: boolean;
    values: TIssueExtraOptions[];
  };
}
