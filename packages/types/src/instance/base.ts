/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IUserLite } from "../users";
import type {
  TInstanceAIConfigurationKeys,
  TInstanceEmailConfigurationKeys,
  TInstanceImageConfigurationKeys,
  TInstanceMs365ConfigurationKeys,
  TInstanceAuthenticationKeys,
  TInstanceRateLimitConfigurationKeys,
  TInstanceServiceDeskConfigurationKeys,
  TInstanceWorkspaceConfigurationKeys,
  TCoreLoginMediums,
} from "./";
import type { TExtendedLoginMediums } from "./auth-ee";

export interface IInstanceInfo {
  instance: IInstance;
  config: IInstanceConfig;
}

export interface IInstance {
  id: string;
  created_at: string;
  updated_at: string;
  instance_name: string | undefined;
  whitelist_emails: string | undefined;
  instance_id: string | undefined;
  current_version: string | undefined;
  latest_version: string | undefined;
  last_checked_at: string | undefined;
  namespace: string | undefined;
  is_telemetry_enabled: boolean;
  is_support_required: boolean;
  is_setup_done: boolean;
  is_signup_screen_visited: boolean;
  is_verified: boolean;
  created_by: string | undefined;
  updated_by: string | undefined;
  /** Sent by the instance info only. */
  workspaces_exist?: boolean;
}

export interface IInstanceConfig {
  enable_signup: boolean;
  is_workspace_creation_disabled: boolean;
  is_google_enabled: boolean;
  is_github_enabled: boolean;
  is_gitlab_enabled: boolean;
  is_gitea_enabled: boolean;
  is_oidc_enabled: boolean;
  oidc_provider_name: string | undefined;
  is_magic_login_enabled: boolean;
  is_email_password_enabled: boolean;
  github_app_name: string | undefined;
  slack_client_id: string | undefined;
  has_unsplash_configured: boolean;
  has_llm_configured: boolean;
  file_size_limit: number | undefined;
  is_smtp_configured: boolean;
  app_base_url: string | undefined;
  space_base_url: string | undefined;
  admin_base_url: string | undefined;
  is_self_managed: boolean;
  instance_changelog_url?: string;
  /** Origin of the draw.io editor the diagram block embeds. */
  diagram_embed_origin?: string;
  /** Origins the embed block may render in an iframe; anything else is a link. */
  external_embed_allowed_origins?: string[];
}

export interface IInstanceAdmin {
  created_at: string;
  created_by: string | null;
  id: string;
  instance: string;
  role: number;
  updated_at: string;
  updated_by: string | null;
  user: string | null;
  user_detail: Pick<IUserLite, "id" | "first_name" | "last_name" | "display_name" | "avatar_url" | "email"> | null;
}

export type TInstanceConfigurationKeys =
  | TInstanceAIConfigurationKeys
  | TInstanceEmailConfigurationKeys
  | TInstanceImageConfigurationKeys
  | TInstanceMs365ConfigurationKeys
  | TInstanceAuthenticationKeys
  | TInstanceRateLimitConfigurationKeys
  | TInstanceServiceDeskConfigurationKeys
  | TInstanceWorkspaceConfigurationKeys;

export interface IInstanceConfiguration {
  id: string;
  created_at: string;
  updated_at: string;
  /** A known key, or one this client does not know yet. */
  key: string;
  value: string;
  // True when the key is reconciled by the Helm chart; the UI shows it read-only.
  is_managed: boolean;
  created_by: string | null;
  updated_by: string | null;
}

/** Values by configuration key. Keys this client does not know yet stay readable. */
export type IFormattedInstanceConfiguration = Partial<Record<TInstanceConfigurationKeys, string>> &
  Record<string, string | undefined>;

export type TLoginMediums = TCoreLoginMediums | TExtendedLoginMediums;
