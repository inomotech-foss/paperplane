/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssueActivity } from "@plane/types";
import { fetchWorkItemHistory, isHistoryActivity } from "./work-item-history";

export class IssueActivityService {
  async getIssueActivities(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    createdAfter?: string
  ): Promise<TIssueActivity[]> {
    const entries = await fetchWorkItemHistory(workspaceSlug, projectId, issueId, "issue-property", createdAfter);
    return entries.filter(isHistoryActivity);
  }
}
