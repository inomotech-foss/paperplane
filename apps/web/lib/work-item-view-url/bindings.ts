// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { EIssuesStoreType } from "@plane/types";
import { getProjectUrl } from "@/components/project/features/features";
import { isWorkItemsEnabled } from "@/components/settings/project/work-items-dependency";
import { checkWorkItemQuery } from "@/components/work-item-query/check";
import { store } from "@/lib/store-context";
import { IssueService } from "@/services/issue";
import { richFiltersEqual } from "./codecs";
import { getWorkItemPage } from "./pages";
import type { TViewBinding } from "./route";
import { createPeekBinding, findIssueIdByRef, formatPeekRef } from "./peek";
import type { TPeekBinding } from "./peek";
import type { TCalendarClock } from "./types";

export const PROJECT_WORK_ITEMS_PAGE = getWorkItemPage(EIssuesStoreType.PROJECT);

const toDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// week start only matters once `d` is applied (PR 7), which must then ensure the profile is loaded
const getClock = (): TCalendarClock => ({
  today: toDay(new Date()),
  weekStart: store.user.userProfile.data.start_of_the_week,
});

/** Client only: wires the root store and services into the project work items route. */
export const getProjectWorkItemsBinding = (workspaceSlug: string, projectId: string): TViewBinding => {
  const { projectIssuesFilter: filters, projectIssues: issues } = store.issue;
  return {
    page: PROJECT_WORK_ITEMS_PAGE,
    entityId: projectId,
    deps: {
      loadSaved: () => filters.loadSavedFilters(workspaceSlug, projectId),
      validatePql: (pql) => checkWorkItemQuery(workspaceSlug, pql, projectId),
      clock: getClock,
    },
    store: filters,
    effects: {
      clear: () => issues.clear(true),
      refetch: () => {
        issues.fetchIssuesWithExistingPagination(workspaceSlug, projectId, "mutation").catch((error: unknown) => {
          console.error(error);
        });
      },
      setRichFilters: (richFilters) => {
        // the filter bar already shows a change made in it
        const filter = store.workItemFilters.getFilter(EIssuesStoreType.PROJECT, projectId);
        if (filter && !richFiltersEqual(filter.adapter.toExternal(filter.expression), richFilters)) {
          filter.resetExpression(richFilters ?? {}, { notify: false });
        }
      },
    },
    // unknown projects pass, the feature guard checks them once loaded
    redirect: () => {
      const project = store.projectRoot.project.getPartialProjectById(projectId);
      return project && !isWorkItemsEnabled(project) ? getProjectUrl(workspaceSlug, projectId) : undefined;
    },
  };
};

const issueService = new IssueService();

/** Client only: shows the peek of the project work items route from its URL. */
export const getWorkItemPeekBinding = (workspaceSlug: string, notFound: () => void): TPeekBinding => {
  const { issues, issueDetail } = store.issue;
  const getProjectIdentifier = (projectId: string) => store.projectRoot.project.getProjectIdentifierById(projectId);
  return createPeekBinding(workspaceSlug, {
    getIssue: (issueId) => issues.getIssueById(issueId),
    findIssueId: (ref) =>
      issues.getIssueIdByIdentifier(formatPeekRef(ref)) ??
      findIssueIdByRef(Object.values(issues.issuesMap), getProjectIdentifier, ref),
    getProjectIdentifier,
    lookupIssue: async ({ projectIdentifier, sequenceId }) =>
      (await issueService.retrieveWithIdentifier(workspaceSlug, projectIdentifier, String(sequenceId))).issue,
    show: (peek) => issueDetail.showPeekIssue(peek),
    notFound,
  });
};
