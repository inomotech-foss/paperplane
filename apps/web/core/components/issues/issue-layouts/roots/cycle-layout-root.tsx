/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { isEmpty } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane constants
import { EIssueFilterType, ISSUE_DISPLAY_FILTERS_BY_PAGE, PROJECT_VIEW_TRACKER_ELEMENTS } from "@plane/constants";
import { EIssuesStoreType, EIssueLayoutTypes } from "@plane/types";
// components
import { TransferIssues } from "@/components/cycles/transfer-issues";
import { TransferIssuesModal } from "@/components/cycles/transfer-issues-modal";
// hooks
import { ProjectLevelWorkItemFiltersHOC } from "@/components/work-item-filters/filters-hoc/project-level";
import { WorkItemFiltersRow } from "@/components/work-item-filters/filters-row";
import { WorkItemQueryBar, appliedQuery } from "@/components/work-item-query";
import { useCycle } from "@/hooks/store/use-cycle";
import { useIssues } from "@/hooks/store/use-issues";
import { IssuesStoreContext } from "@/hooks/use-issue-layout-store";
// local imports
import { IssuePeekOverview } from "../../peek-overview";
import { CycleCalendarLayout } from "../calendar/roots/cycle-root";
import { BaseGanttRoot } from "../gantt";
import { CycleKanBanLayout } from "../kanban/roots/cycle-root";
import { CycleListLayout } from "../list/roots/cycle-root";
import { CycleSpreadsheetLayout } from "../spreadsheet/roots/cycle-root";

function CycleIssueLayout(props: {
  activeLayout: EIssueLayoutTypes | undefined;
  cycleId: string;
  isCompletedCycle: boolean;
}) {
  switch (props.activeLayout) {
    case EIssueLayoutTypes.LIST:
      return <CycleListLayout />;
    case EIssueLayoutTypes.KANBAN:
      return <CycleKanBanLayout />;
    case EIssueLayoutTypes.CALENDAR:
      return <CycleCalendarLayout />;
    case EIssueLayoutTypes.GANTT:
      return <BaseGanttRoot viewId={props.cycleId} isCompletedCycle={props.isCompletedCycle} />;
    case EIssueLayoutTypes.SPREADSHEET:
      return <CycleSpreadsheetLayout />;
    default:
      return null;
  }
}

/** Route params as plain strings; the layout renders nothing until all three are present. */
const useCycleRouteIds = () => {
  const { workspaceSlug, projectId, cycleId } = useParams();
  return {
    workspaceSlug: workspaceSlug?.toString(),
    projectId: projectId?.toString(),
    cycleId: cycleId?.toString(),
  };
};

/** The cycle's stored filters, fetched once per cycle. */
const useCycleWorkItemFilters = (
  workspaceSlug: string | undefined,
  projectId: string | undefined,
  cycleId: string | undefined
) => {
  const { issuesFilter } = useIssues(EIssuesStoreType.CYCLE);
  const workItemFilters = cycleId ? issuesFilter?.getIssueFilters(cycleId) : undefined;
  useSWR(
    workspaceSlug && projectId && cycleId ? `CYCLE_ISSUES_${workspaceSlug}_${projectId}_${cycleId}` : null,
    async () => {
      if (workspaceSlug && projectId && cycleId) await issuesFilter?.fetchFilters(workspaceSlug, projectId, cycleId);
    },
    { revalidateIfStale: false, revalidateOnFocus: false }
  );
  return { issuesFilter, workItemFilters };
};

/** Whether the cycle is over and whether its unfinished work can still be moved to another cycle. */
const useCycleTransferState = (cycleId: string | undefined) => {
  const { getCycleById } = useCycle();
  const cycleDetails = cycleId ? getCycleById(cycleId) : undefined;
  const isCompletedCycle = (cycleDetails?.status?.toLocaleLowerCase() ?? "draft") === "completed";
  const hasProgressSnapshot = !isEmpty(cycleDetails?.progress_snapshot);
  const transferableIssuesCount = cycleDetails
    ? cycleDetails.backlog_issues + cycleDetails.unstarted_issues + cycleDetails.started_issues
    : 0;
  return {
    isCompletedCycle,
    hasProgressSnapshot,
    canTransferIssues: !hasProgressSnapshot && transferableIssuesCount > 0,
  };
};

export const CycleLayoutRoot = observer(function CycleLayoutRoot() {
  const { workspaceSlug, projectId, cycleId } = useCycleRouteIds();
  // store hooks
  const { issuesFilter, workItemFilters } = useCycleWorkItemFilters(workspaceSlug, projectId, cycleId);
  const { isCompletedCycle, hasProgressSnapshot, canTransferIssues } = useCycleTransferState(cycleId);
  // state
  const [transferIssuesModal, setTransferIssuesModal] = useState(false);
  // derived values
  const activeLayout = workItemFilters?.displayFilters?.layout;

  if (!workspaceSlug || !projectId || !cycleId || !workItemFilters) return <></>;
  return (
    <IssuesStoreContext.Provider value={EIssuesStoreType.CYCLE}>
      <ProjectLevelWorkItemFiltersHOC
        enableSaveView
        entityType={EIssuesStoreType.CYCLE}
        entityId={cycleId}
        filtersToShowByLayout={ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.filters}
        initialWorkItemFilters={workItemFilters}
        updateFilters={issuesFilter?.updateFilterExpression.bind(issuesFilter, workspaceSlug, projectId, cycleId)}
        projectId={projectId}
        workspaceSlug={workspaceSlug}
      >
        {({ filter: cycleWorkItemsFilter }) => (
          <>
            <TransferIssuesModal
              handleClose={() => setTransferIssuesModal(false)}
              cycleId={cycleId}
              isOpen={transferIssuesModal}
            />
            <div className="relative flex h-full w-full flex-col overflow-hidden">
              {isCompletedCycle && (
                <TransferIssues
                  handleClick={() => setTransferIssuesModal(true)}
                  canTransferIssues={canTransferIssues}
                  disabled={hasProgressSnapshot}
                />
              )}
              {cycleWorkItemsFilter && (
                <WorkItemFiltersRow
                  filter={cycleWorkItemsFilter}
                  trackerElements={{
                    saveView: PROJECT_VIEW_TRACKER_ELEMENTS.CYCLE_HEADER_SAVE_AS_VIEW_BUTTON,
                  }}
                />
              )}
              <WorkItemQueryBar
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                value={appliedQuery(workItemFilters)}
                onApply={(pql) =>
                  issuesFilter.updateFilters(
                    workspaceSlug,
                    projectId,
                    EIssueFilterType.DISPLAY_FILTERS,
                    { pql },
                    cycleId
                  )
                }
              />
              <div className="h-full w-full overflow-auto">
                <CycleIssueLayout activeLayout={activeLayout} cycleId={cycleId} isCompletedCycle={isCompletedCycle} />
              </div>
              {/* peek overview */}
              <IssuePeekOverview />
            </div>
          </>
        )}
      </ProjectLevelWorkItemFiltersHOC>
    </IssuesStoreContext.Provider>
  );
});
