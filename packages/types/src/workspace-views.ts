/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IIssueDisplayFilterOptions, IIssueDisplayProperties, TWorkItemFilterExpression } from "./client-json";
import type { EViewAccess } from "./views";

export interface IWorkspaceView {
  id: string;
  access: EViewAccess;
  created_at: string;
  updated_at: string;
  is_favorite?: boolean;
  created_by: string | null;
  updated_by: string | null;
  name: string;
  description: string;
  rich_filters: TWorkItemFilterExpression;
  display_filters: IIssueDisplayFilterOptions;
  display_properties: IIssueDisplayProperties;
  project: string | null;
  workspace: string;
  is_locked: boolean;
  owned_by: string;
}

export const STATIC_VIEW_TYPES = ["all-issues", "assigned", "created", "subscribed"];

export type TStaticViewTypes = (typeof STATIC_VIEW_TYPES)[number];
