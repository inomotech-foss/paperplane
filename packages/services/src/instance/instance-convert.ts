// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { AdminApiResponse, AdminApiSchema } from "@plane/api-types";
import type { IInstance, IInstanceConfig, IInstanceConfiguration, IInstanceInfo } from "@plane/types";

type TInstanceRow = AdminApiSchema<"Instance"> | AdminApiSchema<"InstanceDetail">;

/** Activation flags only, while the instance is not registered. */
export type TUnregisteredInstance = AdminApiSchema<"UnregisteredInstance">;

export function toInstance(row: TInstanceRow): IInstance {
  const instance: IInstance = {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    instance_name: row.instance_name,
    whitelist_emails: row.whitelist_emails ?? undefined,
    instance_id: row.instance_id,
    current_version: row.current_version,
    latest_version: row.latest_version ?? undefined,
    last_checked_at: row.last_checked_at,
    namespace: row.namespace ?? undefined,
    is_telemetry_enabled: row.is_telemetry_enabled,
    is_support_required: row.is_support_required,
    is_setup_done: row.is_setup_done,
    is_signup_screen_visited: row.is_signup_screen_visited,
    is_verified: row.is_verified,
    created_by: row.created_by ?? undefined,
    updated_by: row.updated_by ?? undefined,
  };
  if ("workspaces_exist" in row) instance.workspaces_exist = row.workspaces_exist;
  return instance;
}

/** The public instance config. An unset URL or id is undefined. */
export const toInstanceConfig = (config: AdminApiSchema<"InstanceConfig">): IInstanceConfig => ({
  ...config,
  slack_client_id: config.slack_client_id ?? undefined,
  app_base_url: config.app_base_url ?? undefined,
  space_base_url: config.space_base_url ?? undefined,
  admin_base_url: config.admin_base_url ?? undefined,
  instance_changelog_url: config.instance_changelog_url ?? undefined,
  diagram_embed_origin: config.diagram_embed_origin ?? undefined,
});

/** The instance info, or the activation flags of an instance that is not registered. */
export function toInstanceInfo(
  response: AdminApiResponse<"/api/instances/", "get">
): IInstanceInfo | TUnregisteredInstance {
  if (!("instance" in response)) return response;
  return { config: toInstanceConfig(response.config), instance: toInstance(response.instance) };
}

/** A configuration value. An unset value is the empty string the forms show. */
export const toInstanceConfiguration = (row: AdminApiSchema<"InstanceConfiguration">): IInstanceConfiguration => ({
  id: row.id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  key: row.key,
  value: row.value ?? "",
  is_managed: row.is_managed,
  created_by: row.created_by,
  updated_by: row.updated_by,
});
