/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TTimezone } from "@plane/api-types";
import type { TPaginationInfo } from "./common";
import type { ICycle } from "./cycle";
import type { TUserPermissions } from "./enums";
import type { IUserLite } from "./users";
import type { TLoginMediums } from "./instance";
import type { IWorkspaceViewProps } from "./client-json";
import type { TPqlDialect } from "./issues/work-item-query";

export enum EUserWorkspaceRoles {
  ADMIN = 20,
  MEMBER = 15,
  GUEST = 5,
}

export interface IWorkspace {
  readonly id: string;
  readonly owner: string;
  readonly created_at: string;
  readonly updated_at: string;
  name: string;
  logo_url: string | null;
  /** Absent from create and update responses. */
  readonly total_members?: number;
  readonly slug: string;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  organization_size?: string | null;
  total_projects?: number;
  /** Absent from update responses. */
  role?: number;
  timezone: TTimezone;
  /** The workspace's default PQL dialect; only admins change it. */
  pql_dialect: TPqlDialect;
}

export interface IWorkspaceLite {
  readonly id: string;
  name: string;
  slug: string;
}

export interface IWorkspaceMemberInvitation {
  accepted: boolean;
  email: string;
  id: string;
  message: string | null;
  responded_at: string | null;
  role: TUserPermissions;
  token: string;
  invite_link: string;
  workspace: {
    id: string;
    logo_url: string | null;
    name: string;
    slug: string;
  };
}

export interface IWorkspaceBulkInviteFormData {
  emails: { email: string; role: TUserPermissions }[];
}

export type Properties = {
  assignee: boolean;
  start_date: boolean;
  due_date: boolean;
  labels: boolean;
  key: boolean;
  priority: boolean;
  state: boolean;
  sub_issue_count: boolean;
  link: boolean;
  attachment_count: boolean;
  estimate: boolean;
  created_on: boolean;
  updated_on: boolean;
};

export interface IWorkspaceMember {
  id: string;
  member: IUserLite;
  role: TUserPermissions | EUserWorkspaceRoles;
  created_at?: string;
  avatar_url?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  joining_date?: string;
  display_name?: string;
  last_login_medium?: TLoginMediums;
  is_active?: boolean;
}

export interface IWorkspaceMemberMe {
  company_role: string | null;
  created_at: Date;
  created_by: string;
  default_props: IWorkspaceViewProps;
  id: string;
  member: string;
  role: TUserPermissions | EUserWorkspaceRoles;
  updated_at: Date;
  updated_by: string;
  view_props: IWorkspaceViewProps;
  workspace: string;
  draft_issue_count: number;
  /** The member's own PQL dialect; null follows the workspace's. */
  pql_dialect: TPqlDialect | null;
}

export interface IWorkspaceDefaultSearchResult {
  id: string;
  name: string;
  project_id: string;
  project__identifier: string;
  workspace__slug: string;
}
export interface IWorkspaceSearchResult {
  id: string;
  name: string;
  slug: string;
}

export interface IWorkspaceIssueSearchResult {
  id: string;
  name: string;
  project__identifier: string;
  project_id: string;
  sequence_id: number;
  workspace__slug: string;
  type_id: string;
}

export interface IWorkspacePageSearchResult {
  id: string;
  name: string;
  project_ids: string[];
  project_identifiers: string[];
  workspace__slug: string;
}

export interface IWorkspaceProjectSearchResult {
  id: string;
  identifier: string;
  name: string;
  workspace__slug: string;
}

export interface IWorkspaceSearchResults {
  results: {
    workspace: IWorkspaceSearchResult[];
    project: IWorkspaceProjectSearchResult[];
    issue: IWorkspaceIssueSearchResult[];
    cycle: IWorkspaceDefaultSearchResult[];
    module: IWorkspaceDefaultSearchResult[];
    issue_view: IWorkspaceDefaultSearchResult[];
    page: IWorkspacePageSearchResult[];
  };
}

export interface IWorkspaceActiveCyclesResponse {
  count: number;
  extra_stats: null;
  next_cursor: string;
  next_page_results: boolean;
  prev_cursor: string;
  prev_page_results: boolean;
  results: ICycle[];
  total_pages: number;
}

export interface IWorkspaceProgressResponse {
  completed_issues: number;
  total_issues: number;
  started_issues: number;
  cancelled_issues: number;
  unstarted_issues: number;
}
export interface IWorkspaceAnalyticsResponse {
  completion_chart: Record<string, unknown>;
}

export type TWorkspacePaginationInfo = TPaginationInfo & {
  results: IWorkspace[];
};

export interface IWorkspaceSidebarNavigationItem {
  key?: string;
  is_pinned: boolean;
  sort_order: number;
}

export interface IWorkspaceSidebarNavigation {
  [key: string]: IWorkspaceSidebarNavigationItem;
}

export enum EOnboardingSteps {
  PROFILE_SETUP = "PROFILE_SETUP",
  ROLE_SETUP = "ROLE_SETUP",
  USE_CASE_SETUP = "USE_CASE_SETUP",
  WORKSPACE_CREATE_OR_JOIN = "WORKSPACE_CREATE_OR_JOIN",
  INVITE_MEMBERS = "INVITE_MEMBERS",
}

export type TOnboardingStep = EOnboardingSteps;

export enum ECreateOrJoinWorkspaceViews {
  WORKSPACE_CREATE = "WORKSPACE_CREATE",
  WORKSPACE_JOIN = "WORKSPACE_JOIN",
}
