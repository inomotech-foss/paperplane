/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TPaginationInfo } from "../common";

export interface IInstanceUser {
  id: string;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  is_active: boolean;
  is_bot: boolean;
  deleted_at: string | null;
  /** The user this one was merged into, when it was deleted by a merge. */
  merged_into: string | null;
  is_instance_admin: boolean;
  /** Linked OAuth providers, e.g. "google" or "oidc". */
  providers: string[];
  workspace_count: number;
  last_login_time: string | null;
  date_joined: string;
}

export interface IInstanceUserMembership {
  workspace_id: string;
  slug: string;
  name: string;
  role: number;
  is_active: boolean;
}

export interface IInstanceUserDetail extends IInstanceUser {
  memberships: IInstanceUserMembership[];
  owned_workspaces: { id: string; slug: string; name: string }[];
}

export type TInstanceUserListParams = {
  search?: string;
  is_active?: boolean;
  is_bot?: boolean;
  include_deleted?: boolean;
  cursor?: string;
};

export type TInstanceUserPaginationInfo = TPaginationInfo & {
  results: IInstanceUser[];
};

export type TInstanceUserDeactivation = {
  /** Workspaces left without an active admin. */
  sole_admin_workspaces: string[];
  sole_admin_projects: { workspace: string; name: string }[];
  user: IInstanceUser;
};

export type TInstanceUserMergeRequest = {
  source: string;
  keep_source_email: boolean;
};

export type TInstanceUserMergeResult = {
  survivor: string;
  source: string;
  email: string;
  /** Keyed by "app.Model.field", only relations that changed. */
  relations: Record<string, { moved: number; dropped: number }>;
};

/** Error body of a refused lifecycle call. */
export type TInstanceUserError = {
  error: string;
  owned_workspaces?: string[];
};
