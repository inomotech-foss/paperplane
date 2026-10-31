/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema, InternalPaths } from "@plane/api-types";
import { unwrap } from "@plane/services";
import { parseLogoProps } from "@plane/types";
import type { TLogoProps } from "@plane/types";
import { isOneOf } from "@/helpers/narrow.helper";
import { apiClient } from "@/services/api-client";

export type TPageQueryResult = {
  id: string;
  name: string;
  logo_props: TLogoProps;
  parent: string | null;
  owned_by: string;
  updated_at: string;
  label_ids: string[];
  project_ids: string[];
  /** Only present for the page-properties kind, keyed by requested column. */
  properties?: Record<string, string>;
  /** Editor palette keys for the columns whose value was a status lozenge. */
  property_colors?: Record<string, string>;
};

/** A task or a decision, with the page it was found on. */
export type TPageQueryReportItem = ApiSchema<"PageQueryReportRow">;
export type TPageQueryContributor = ApiSchema<"PageQueryContributor">;
export type TPageQueryLabel = ApiSchema<"PageQueryLabel">;

type TQuery = NonNullable<InternalPaths["/api/workspaces/{slug}/page-query/"]["get"]["parameters"]["query"]>;
type TKind = NonNullable<TQuery["kind"]>;

/** What the query block keeps in its node attributes. */
export type TPageQueryParams = {
  kind: string;
  project_id?: string;
  root_page_id?: string;
  depth?: number;
  labels?: string;
  limit?: number;
  sort?: string;
  reverse?: string;
  scope?: string;
  search?: string;
  columns?: string;
  status?: string;
};

const KINDS: readonly TKind[] = [
  "tree",
  "index",
  "recent",
  "search",
  "contributors",
  "by-label",
  "label-list",
  "page-properties",
  "task-report",
  "decision-report",
];
const SORTS: readonly NonNullable<TQuery["sort"]>[] = ["title", "modified", "created"];
const STATUSES: readonly NonNullable<TQuery["status"]>[] = ["complete", "incomplete"];

/** The documented query for block attributes. Throws for a kind the API does not know. */
export function toPageQuery(params: TPageQueryParams): TQuery {
  if (!isOneOf(KINDS, params.kind)) throw new Error(`Unknown page query kind ${params.kind}`);
  return {
    kind: params.kind,
    scope: params.scope === "project" ? "project" : undefined,
    project_id: params.project_id,
    root_page_id: params.root_page_id,
    depth: params.depth,
    limit: params.limit,
    sort: isOneOf(SORTS, params.sort) ? params.sort : undefined,
    reverse: params.reverse === "true" ? true : undefined,
    search: params.search,
    labels: params.labels,
    columns: params.columns,
    status: isOneOf(STATUSES, params.status) ? params.status : undefined,
  };
}

type TRow = ApiSchema<"PageQueryRow"> | TPageQueryLabel | TPageQueryReportItem | TPageQueryContributor;

const toPageQueryResult = (row: ApiSchema<"PageQueryRow">): TPageQueryResult => ({
  ...row,
  logo_props: parseLogoProps(row.logo_props),
  label_ids: row.label_ids ?? [],
  project_ids: row.project_ids ?? [],
});

/** Errors are thrown as `ApiError` from `@plane/services`. The rows depend on the kind. */
export class PageQueryService {
  private async rows(workspaceSlug: string, params: TPageQueryParams): Promise<TRow[]> {
    const response = await unwrap(
      apiClient.GET("/api/workspaces/{slug}/page-query/", {
        params: { path: { slug: workspaceSlug }, query: toPageQuery(params) },
      })
    );
    return response.results;
  }

  async queryPages(workspaceSlug: string, params: TPageQueryParams): Promise<TPageQueryResult[]> {
    const rows = await this.rows(workspaceSlug, params);
    return rows.flatMap((row) => ("owned_by" in row ? [toPageQueryResult(row)] : []));
  }

  async queryLabels(workspaceSlug: string, params: TPageQueryParams): Promise<TPageQueryLabel[]> {
    const rows = await this.rows(workspaceSlug, params);
    return rows.flatMap((row) => ("name" in row && !("owned_by" in row) ? [row] : []));
  }

  async queryReport(workspaceSlug: string, params: TPageQueryParams): Promise<TPageQueryReportItem[]> {
    const rows = await this.rows(workspaceSlug, params);
    return rows.flatMap((row) => ("value" in row ? [row] : []));
  }

  async queryContributors(workspaceSlug: string, params: TPageQueryParams): Promise<TPageQueryContributor[]> {
    const rows = await this.rows(workspaceSlug, params);
    return rows.flatMap((row) => ("user_id" in row ? [row] : []));
  }
}
