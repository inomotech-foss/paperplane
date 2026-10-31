/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import type { TLogoProps } from "./client-json";
import type { TIssuePriorities } from "./issues";

export type TRecentActivityFilterKeys = "all item" | "issue" | "page" | "project" | "workspace_page";
export type THomeWidgetKeys = ApiSchema<"HomeWidgetKeyEnum">;

export type THomeWidgetProps = {
  workspaceSlug: string;
};

export type TPageEntityData = {
  id: string;
  name: string;
  logo_props: TLogoProps;
  project_id: string | null;
  owned_by: string;
  project_identifier: string | null;
};

export type TProjectEntityData = {
  id: string;
  name: string;
  logo_props: TLogoProps;
  project_members: string[];
  identifier: string;
};

export type TIssueEntityData = {
  id: string;
  name: string;
  state: string | null;
  priority: TIssuePriorities;
  assignees: string[];
  type: string | null;
  sequence_id: number;
  project_id: string;
  project_identifier: string;
};

export type TRecentEntityName = "page" | "project" | "issue" | "workspace_page";

export const RECENT_ENTITY_NAMES: TRecentEntityName[] = ["page", "project", "issue", "workspace_page"];

export type TActivityEntityData = {
  id: string;
  entity_name: TRecentEntityName;
  entity_identifier: string | null;
  visited_at: string;
  /** Null when the entity no longer exists. */
  entity_data: TPageEntityData | TProjectEntityData | TIssueEntityData | null;
};

export type TLinkEditableFields = {
  title: string;
  url: string;
};

export type TLink = ApiSchema<"WorkspaceUserLink">;

export type TLinkMap = {
  [workspace_slug: string]: TLink;
};

export type TLinkIdMap = {
  [workspace_slug: string]: string[];
};

export type TWidgetEntityData = ApiSchema<"WorkspaceHomePreferenceRow">;
