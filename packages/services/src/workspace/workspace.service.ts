/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import type { IWorkspaceSearchResults } from "@plane/types";

export type TWorkspaceSearchParams = {
  project_id?: string;
  search: string;
  workspace_search: boolean;
};

/** Every entity type is requested, so a missing list is an empty one. */
export const toWorkspaceSearchResults = ({ results }: ApiSchema<"GlobalSearch">): IWorkspaceSearchResults => ({
  results: {
    workspace: results.workspace ?? [],
    project: results.project ?? [],
    issue: results.issue ?? [],
    cycle: results.cycle ?? [],
    module: results.module ?? [],
    issue_view: results.issue_view ?? [],
    page: results.page ?? [],
  },
});

export const workspaceSearchQuery = (
  params: TWorkspaceSearchParams
): Omit<TWorkspaceSearchParams, "workspace_search"> & { workspace_search: "true" | "false" } => ({
  ...params,
  workspace_search: params.workspace_search ? "true" : "false",
});
