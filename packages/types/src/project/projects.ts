/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IProjectMemberNavigationPreferences, TLogoProps } from "../client-json";
import type { TUserPermissions } from "../enums";
import type { TStateGroups } from "../state";
import type { IUser, IUserLite } from "../users";
import type { IWorkspace } from "../workspace";

export enum EUserProjectRoles {
  ADMIN = 20,
  MEMBER = 15,
  GUEST = 5,
}

export interface IPartialProject {
  id: string;
  name: string;
  identifier: string;
  sort_order: number | null;
  logo_props: TLogoProps;
  member_role?: TUserPermissions | EUserProjectRoles | null;
  archived_at: string | null;
  workspace: IWorkspace | string;
  cycle_view: boolean;
  issue_views_view: boolean;
  module_view: boolean;
  page_view: boolean;
  issue_view: boolean;
  inbox_view: boolean;
  guest_view_all_features?: boolean;
  project_lead?: IUserLite | string | null;
  network?: number;
  // Timestamps
  created_at?: string;
  updated_at?: string;
  // actor
  created_by?: string | null;
  updated_by?: string | null;
  intake_count?: number;
}

export interface IProject extends IPartialProject {
  archive_in?: number;
  close_in?: number;
  cover_image_asset?: string | null;
  cover_image?: string | null;
  // only for rendering the cover image
  readonly cover_image_url?: string | null;
  default_assignee?: IUser | string | null;
  default_state?: string | null;
  description?: string;
  estimate?: string | null;
  anchor?: string | null;
  is_favorite?: boolean;
  members?: string[];
  timezone?: string;
  next_work_item_sequence?: number;
}

export type TProjectAnalyticsCountParams = {
  project_ids?: string;
  fields?: string;
};

export type TProjectAnalyticsCount = Pick<IProject, "id"> & {
  total_issues?: number | null;
  completed_issues?: number | null;
  total_cycles?: number | null;
  total_members?: number | null;
  total_modules?: number | null;
};

export interface IProjectLite {
  id: string;
  name: string;
  identifier: string;
  logo_props: TLogoProps;
}

export interface IProjectMap {
  [id: string]: IProject;
}

export interface IProjectMemberLite {
  id: string;
  member__avatar_url: string;
  member__display_name: string;
  member_id: string;
}

export type TProjectMembership = {
  member: string;
  role: TUserPermissions | EUserProjectRoles;
} & (
  | {
      id: string;
      original_role: EUserProjectRoles;
      created_at: string;
    }
  | {
      id: null;
      original_role: null;
      created_at: null;
    }
);

export interface IProjectBulkAddFormData {
  members: { role: TUserPermissions | EUserProjectRoles; member_id: string }[];
}

export type IProjectMemberPreferencesUpdate = {
  navigation: IProjectMemberNavigationPreferences;
};

export type IProjectMemberPreferencesResponse = {
  preferences: {
    navigation: IProjectMemberNavigationPreferences;
  };
};

export type IProjectMemberPreferencesFullResponse = IProjectMemberPreferencesResponse & {
  project_id: string;
  member_id: string;
  workspace_id: string;
};

export interface IGithubRepository {
  id: string;
  full_name: string;
  html_url: string;
  url: string;
}

export interface GithubRepositoriesResponse {
  repositories: IGithubRepository[];
  total_count: number;
}

export type TProjectIssuesSearchParams = {
  search: string;
  parent?: boolean;
  issue_relation?: boolean;
  cycle?: boolean;
  module?: string;
  sub_issue?: boolean;
  issue_id?: string;
  workspace_search: boolean;
  target_date?: string;
  /** only work items that have sub-work items */
  has_children?: boolean;
  /** at most this many results (default 100, at most 2000) */
  limit?: number;
};

export interface ISearchIssueResponse {
  id: string;
  name: string;
  project_id: string;
  project__identifier: string;
  project__name: string;
  sequence_id: number;
  start_date: string | null;
  state__color: string | null;
  state__group: TStateGroups | null;
  state__name: string | null;
  workspace__slug: string;
  type_id: string;
}

export type TPartialProject = IPartialProject;

export type TProject = TPartialProject & IProject;
