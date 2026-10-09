// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useMemo } from "react";
import { useTranslation } from "@plane/i18n";
import { EIssuesStoreType } from "@plane/types";
import { useIssues } from "@/hooks/store/use-issues";
import { useWorkItemFilters } from "@/hooks/store/work-item-filters/use-work-item-filters";
import { getWorkItemPage } from "@/lib/work-item-view-url";
import type { TViewUrlAdapter } from "@/lib/work-item-view-url/provider";
import { WorkItemQueryService } from "@/services/issue";

export const PROJECT_WORK_ITEMS_PAGE = getWorkItemPage(EIssuesStoreType.PROJECT);

const workItemQueryService = new WorkItemQueryService();

/** Connects the project work item filters to the URL. */
export const useProjectViewUrlAdapter = (workspaceSlug: string, projectId: string): TViewUrlAdapter => {
  const { t } = useTranslation();
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.PROJECT);
  const { getFilter } = useWorkItemFilters();

  return useMemo(
    () => ({
      key: `${workspaceSlug}/${projectId}`,
      entityId: projectId,
      page: PROJECT_WORK_ITEMS_PAGE,
      store: issuesFilter,
      getSaved: () => issuesFilter.savedFilters[projectId],
      loadSaved: () => issuesFilter.loadSavedFilters(workspaceSlug, projectId),
      effects: {
        clear: () => issues.clear(true),
        refetch: () => {
          issues.fetchIssuesWithExistingPagination(workspaceSlug, projectId, "mutation").catch((error: unknown) => {
            console.error(error);
          });
        },
        setRichFilters: (richFilters) =>
          getFilter(EIssuesStoreType.PROJECT, projectId)?.resetExpression(richFilters ?? {}, { notify: false }),
      },
      validatePql: async (pql) => {
        try {
          const result = await workItemQueryService.validate(workspaceSlug, pql, projectId);
          return result.valid ? undefined : (result.error ?? t("work_item_query.invalid"));
        } catch {
          // a failed check is no reason to drop the query; the list reports a broken one
          return undefined;
        }
      },
    }),
    [workspaceSlug, projectId, issues, issuesFilter, getFilter, t]
  );
};
