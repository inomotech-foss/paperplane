// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TWorkItemQueryValidation } from "@plane/types";
import { WorkItemQueryService } from "@/services/issue";

const workItemQueryService = new WorkItemQueryService();

const checks = new Map<string, Promise<TWorkItemQueryValidation>>();

/**
 * Validates a query once per session and scope. `refresh` asks the server again and keeps that answer,
 * e.g. when the person runs the query. A failed request is not kept.
 */
export const checkWorkItemQuery = (
  workspaceSlug: string,
  pql: string,
  projectId?: string,
  refresh = false
): Promise<TWorkItemQueryValidation> => {
  const key = JSON.stringify([workspaceSlug, projectId ?? null, pql]);
  const cached = checks.get(key);
  if (cached && !refresh) return cached;
  const check = workItemQueryService.validate(workspaceSlug, pql, projectId);
  checks.set(key, check);
  check.catch(() => {
    if (checks.get(key) === check) checks.delete(key);
  });
  return check;
};
