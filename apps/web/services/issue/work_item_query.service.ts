/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TWorkItemQueryFields, TWorkItemQueryValidation } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

/** Plane Query Language helpers: validate an expression, list its vocabulary. */
export class WorkItemQueryService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async validate(workspaceSlug: string, pql: string, projectId?: string): Promise<TWorkItemQueryValidation> {
    return this.post(`/api/workspaces/${workspaceSlug}/work-item-query/validate/`, {
      pql,
      project_id: projectId ?? null,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async fields(workspaceSlug: string): Promise<TWorkItemQueryFields> {
    return this.get(`/api/workspaces/${workspaceSlug}/work-item-query/fields/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
