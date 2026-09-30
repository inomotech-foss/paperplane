/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TLogoProps } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export type TPageQueryResult = {
  id: string;
  name: string;
  logo_props: TLogoProps | null;
  parent: string | null;
  owned_by: string | null;
  updated_at: string;
  label_ids: string[];
  project_ids: string[];
  /** Only present for the page-properties kind, keyed by requested column. */
  properties?: Record<string, string>;
  /** Editor palette keys for the columns whose value was a status lozenge. */
  property_colors?: Record<string, string>;
};

/** A task or a decision, with the page it was found on. */
export type TPageQueryReportItem = {
  id: string;
  value: string;
  is_complete: boolean;
  assignee_id: string | null;
  due_date: string | null;
  page_id: string;
  page_name: string;
  project_id: string | null;
};

export type TPageQueryContributor = {
  user_id: string;
  page_count: number;
};

export type TPageQueryLabel = {
  id: string;
  name: string;
};

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

export class PageQueryService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async query<T = TPageQueryResult>(workspaceSlug: string, params: TPageQueryParams): Promise<T[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/page-query/`, { params })
      .then((response) => response?.data?.results ?? [])
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
