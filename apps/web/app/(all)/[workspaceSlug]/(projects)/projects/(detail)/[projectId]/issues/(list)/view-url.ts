// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useCallback } from "react";
import { EIssuesStoreType, EStartOfTheWeek } from "@plane/types";
import { getWorkItemPage } from "@/lib/work-item-view-url";
import { richFiltersEqual } from "@/lib/work-item-view-url/codecs";
import { loadViewState } from "@/lib/work-item-view-url/route";
import type { TViewLoaderData } from "@/lib/work-item-view-url/route";
import { useWorkItemViewRoute } from "@/lib/work-item-view-url/use-view-route";
import { store } from "@/lib/store-context";
import { WorkItemQueryService } from "@/services/issue";

export const PROJECT_WORK_ITEMS_PAGE = getWorkItemPage(EIssuesStoreType.PROJECT);

const workItemQueryService = new WorkItemQueryService();

const getWeekStart = () => store.user.userProfile.data?.start_of_the_week ?? EStartOfTheWeek.SUNDAY;

/** For the clientLoader: shows the project's work items the way the URL asks. */
export const loadProjectWorkItemsView = (request: Request, workspaceSlug: string, projectId: string) => {
  const { projectIssuesFilter: filters, projectIssues: issues } = store.issue;
  return loadViewState(request, {
    page: PROJECT_WORK_ITEMS_PAGE,
    entityId: projectId,
    store: filters,
    loadSaved: () => filters.loadSavedFilters(workspaceSlug, projectId),
    validatePql: (pql) => workItemQueryService.validate(workspaceSlug, pql, projectId),
    weekStart: getWeekStart(),
    isShown: () => filters.viewRoute?.entityId === projectId,
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
  });
};

/** Call from the layout's observer component. */
export const useProjectWorkItemsViewRoute = (data: TViewLoaderData, projectId: string) => {
  const filters = store.issue.projectIssuesFilter;
  const getSaved = useCallback(() => filters.savedFilters[projectId], [filters, projectId]);
  return useWorkItemViewRoute(data, {
    page: PROJECT_WORK_ITEMS_PAGE,
    entityId: projectId,
    setRoute: filters.setViewRoute,
    getSaved,
    weekStart: getWeekStart(),
  });
};
