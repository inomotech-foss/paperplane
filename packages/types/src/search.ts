/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import type { TLogoProps } from "./client-json";

export type TSearchEntities = "user_mention" | "issue" | "project" | "cycle" | "module" | "page";

export type TUserSearchResponse = ApiSchema<"Mention">;

export type TProjectSearchResponse = Omit<ApiSchema<"EntitySearchProject">, "logo_props"> & { logo_props: TLogoProps };

export type TIssueSearchResponse = ApiSchema<"EntitySearchWorkItem">;

export type TCycleSearchResponse = ApiSchema<"EntitySearchPlan">;

export type TModuleSearchResponse = ApiSchema<"EntitySearchPlan">;

export type TPageSearchResponse = Omit<ApiSchema<"EntitySearchPage">, "logo_props"> & { logo_props: TLogoProps };

export type TSearchResponse = {
  cycle?: TCycleSearchResponse[];
  issue?: TIssueSearchResponse[];
  module?: TModuleSearchResponse[];
  page?: TPageSearchResponse[];
  project?: TProjectSearchResponse[];
  user_mention?: TUserSearchResponse[];
};

export type TSearchEntityRequestPayload = {
  count: number;
  project_id?: string;
  query_type: TSearchEntities[];
  query: string;
  team_id?: string;
  issue_id?: string;
};
