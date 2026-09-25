/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Dispatch, MouseEvent, SetStateAction } from "react";
// plane imports
import type { TIssue } from "@plane/types";
// store
import type { IIssueSubIssuesStore } from "@/store/issue/issue-details/sub_issues.store";

type Params = {
  issueDetail: TIssue;
  workspaceSlug: string | undefined;
  subIssuesStore: Pick<IIssueSubIssuesStore, "subIssuesByIssueId" | "fetchSubIssues">;
  /** Children already on screen in hierarchy mode; the rest is fetched on expand. */
  loadedChildCount: number;
  setExpanded: Dispatch<SetStateAction<boolean>>;
};

/**
 * Whether a table row can expand and what expanding it does. Children can
 * be shown from what the list already loaded; a fetch is only needed when
 * the work item has more children than that.
 */
export const useSubIssueExpansion = (params: Params) => {
  const { issueDetail, workspaceSlug, subIssuesStore, loadedChildCount, setExpanded } = params;
  const subIssuesCount = issueDetail.sub_issues_count ?? 0;
  const hasChildren = subIssuesCount > 0 || loadedChildCount > 0;
  const isFetched = subIssuesStore.subIssuesByIssueId(issueDetail.id) !== undefined;
  const needsFetch = subIssuesCount > loadedChildCount && !isFetched;
  const projectId = issueDetail.project_id;

  const handleToggleExpand = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setExpanded((wasExpanded) => {
      const shouldFetch = !wasExpanded && needsFetch && !!workspaceSlug && !!projectId;
      if (shouldFetch) subIssuesStore.fetchSubIssues(workspaceSlug, projectId, issueDetail.id);
      return !wasExpanded;
    });
  };

  return { hasChildren, handleToggleExpand };
};
