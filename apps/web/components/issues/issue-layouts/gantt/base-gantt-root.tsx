/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { ALL_ISSUES, EIssueFilterType, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { EIssuesStoreType, IBlockUpdateData, TIssue } from "@plane/types";
import { EIssueLayoutTypes, GANTT_TIMELINE_TYPE } from "@plane/types";
import { renderFormattedPayloadDate } from "@plane/utils";
// components
import { TimeLineTypeContext } from "@/components/gantt-chart/contexts";
import { GanttChartRoot } from "@/components/gantt-chart/root";
import { IssueGanttSidebar } from "@/components/gantt-chart/sidebar/issues/sidebar";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useUserPermissions } from "@/hooks/store/user";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import useLocalStorage from "@/hooks/use-local-storage";
import { useIssuesTimeLineChart, useTimeLineChart } from "@/hooks/use-timeline-chart";
import { useBulkOperationStatus } from "@/hooks/use-bulk-operation-status";
// local imports
import { IssueLayoutHOC } from "../issue-layout-HOC";
import { GanttQuickAddIssueButton } from "../quick-add/button/gantt";
import { QuickAddIssueRoot } from "../quick-add/root";
import { IssueGanttBlock } from "./blocks";
import type { TGanttExpansion } from "./hierarchy";
import { DEFAULT_GANTT_EXPANSION, buildGanttRows, showGanttLevels, toggleGanttRow } from "./hierarchy";
import type { TGanttHierarchyContext, TGanttRowState } from "./hierarchy-context";
import { GanttHierarchyContext } from "./hierarchy-context";
import { GanttHierarchyControls } from "./hierarchy-controls";

interface IBaseGanttRoot {
  viewId?: string | undefined;
  isCompletedCycle?: boolean;
  isEpic?: boolean;
}

// A cheap fingerprint of what the rolled-up dates depend on, so they are only
// refetched when a loaded work item moves, is re-parented or changes dates.
const hashRollupInputs = (issueIds: string[], getIssueById: (issueId: string) => TIssue | undefined) => {
  let hash = 5381;
  for (const issueId of issueIds) {
    const issue = getIssueById(issueId);
    const key = `${issueId}|${issue?.parent_id}|${issue?.start_date}|${issue?.target_date}|${issue?.sub_issues_count};`;
    for (let index = 0; index < key.length; index++) hash = ((hash << 5) + hash + key.charCodeAt(index)) | 0;
  }
  return hash;
};

export type GanttStoreType =
  | EIssuesStoreType.PROJECT
  | EIssuesStoreType.MODULE
  | EIssuesStoreType.CYCLE
  | EIssuesStoreType.PROJECT_VIEW
  | EIssuesStoreType.EPIC;

type TRowStateSources = {
  hasChildren: (issueId: string) => boolean;
  isLoading: (issueId: string) => boolean;
  /** The work item's sub-work item count, which also counts children the view does not list. */
  getSubIssueCount: (issueId: string) => number | undefined;
};

/** The fold state of every row, as the sidebar rows read it. */
const getRowStates = (rows: ReturnType<typeof buildGanttRows>["rows"], sources: TRowStateSources) => {
  const rowStates: Record<string, TGanttRowState> = {};
  for (const [issueId, row] of rows) {
    const isExpanded = row.isExpanded && row.childIds.length > 0;
    rowStates[issueId] = {
      depth: row.depth,
      hasChildren: sources.hasChildren(issueId),
      isExpanded,
      isLoading: sources.isLoading(issueId),
      hiddenCount: isExpanded ? 0 : (sources.getSubIssueCount(issueId) ?? row.childIds.length),
    };
  }
  return rowStates;
};

export const BaseGanttRoot = observer(function BaseGanttRoot(props: IBaseGanttRoot) {
  const { viewId, isCompletedCycle = false, isEpic = false } = props;
  const { t } = useTranslation();
  // router
  const { workspaceSlug, projectId } = useParams();

  const storeType = useIssueStoreType() as GanttStoreType;
  const { issues, issuesFilter } = useIssues(storeType);
  const { fetchIssues, fetchNextIssues, updateIssue, quickAddIssue, updateFilters } = useIssuesActions(storeType);
  const { initGantt } = useTimeLineChart(GANTT_TIMELINE_TYPE.ISSUE);
  const { isDateRollupEnabled, fetchDateRollups } = useIssuesTimeLineChart();
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const {
    issue: { getIssueById },
    subIssues: subIssuesStore,
  } = useIssueDetail();
  // fold state, per person and per view
  const { storedValue: storedExpansion, setValue: setExpansion } = useLocalStorage<TGanttExpansion>(
    `timeline_hierarchy_${workspaceSlug}_${projectId}_${viewId ?? storeType}`,
    DEFAULT_GANTT_EXPANSION
  );
  const expansion = storedExpansion ?? DEFAULT_GANTT_EXPANSION;
  // rows unfolded here whose children the view does not list, so they were fetched on unfold
  const [fetchedParentIds, setFetchedParentIds] = useState<Set<string>>(() => new Set());
  const [loadingParentIds, setLoadingParentIds] = useState<Set<string>>(() => new Set());

  const appliedDisplayFilters = issuesFilter.issueFilters?.displayFilters;
  // plane web hooks
  const isBulkOperationsEnabled = useBulkOperationStatus();
  // derived values
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1);

  useEffect(() => {
    fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, viewId);
  }, [fetchIssues, storeType, viewId]);

  useEffect(() => {
    initGantt();
  }, []);

  const { visibleIds, rows, levelCount } = buildGanttRows({
    issueIds: (issues.groupedIssueIds?.[ALL_ISSUES] as string[]) ?? [],
    getParentId: (issueId) => getIssueById(issueId)?.parent_id,
    getFetchedChildIds: (issueId) =>
      fetchedParentIds.has(issueId) ? subIssuesStore.subIssuesByIssueId(issueId) : undefined,
    expansion,
  });
  const hasChildren = (issueId: string) =>
    (rows.get(issueId)?.childIds.length ?? 0) > 0 || (getIssueById(issueId)?.sub_issues_count ?? 0) > 0;
  const loadedIds = [...rows.keys()];
  const parentIds = loadedIds.filter(hasChildren);

  // fetch the dates of the work items below every parent when the loaded ones change
  const rollupInputsHash = hashRollupInputs(loadedIds, getIssueById);
  useEffect(() => {
    if (!isDateRollupEnabled || !workspaceSlug || !projectId || parentIds.length === 0) return;
    const timeout = setTimeout(() => {
      fetchDateRollups(workspaceSlug.toString(), projectId.toString(), parentIds).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timeout);
    // parentIds is derived from the same inputs as the hash
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [rollupInputsHash, isDateRollupEnabled, workspaceSlug, projectId]);

  const toggleRow = useCallback(
    async (issueId: string) => {
      const row = rows.get(issueId);
      const issue = getIssueById(issueId);
      if (!row || !issue) return;
      const isShownExpanded = row.isExpanded && row.childIds.length > 0;
      if (isShownExpanded) {
        setExpansion(toggleGanttRow(expansion, issueId, true));
        return;
      }
      setExpansion({ ...expansion, overrides: { ...expansion.overrides, [issueId]: true } });
      // the view does not list this row's children (e.g. sub-work items are hidden): fetch them
      if (row.childIds.length > 0 || !issue.sub_issues_count || isEpic || !workspaceSlug || !issue.project_id) return;
      const issueProjectId = issue.project_id;
      setFetchedParentIds((previous) => new Set(previous).add(issueId));
      if (subIssuesStore.subIssuesByIssueId(issueId)) return;
      setLoadingParentIds((previous) => new Set(previous).add(issueId));
      try {
        await subIssuesStore.fetchSubIssues(workspaceSlug.toString(), issueProjectId, issueId);
      } catch {
        setToast({ type: "error", title: t("toast.error"), message: t("timeline_hierarchy.load_error") });
      } finally {
        setLoadingParentIds((previous) => {
          const next = new Set(previous);
          next.delete(issueId);
          return next;
        });
      }
    },
    [rows, expansion, setExpansion, getIssueById, isEpic, workspaceSlug, subIssuesStore, t]
  );

  // the row states as plain data, so the context value only changes when one of them does
  const rowStates = getRowStates(rows, {
    hasChildren,
    isLoading: (issueId) => loadingParentIds.has(issueId),
    getSubIssueCount: (issueId) => getIssueById(issueId)?.sub_issues_count,
  });
  const rowStatesKey = JSON.stringify(rowStates);
  // toggleRow closes over this render's rows; the context reaches the latest one through a ref
  const toggleRowRef = useRef(toggleRow);
  useEffect(() => {
    toggleRowRef.current = toggleRow;
  });
  const hierarchyContext = useMemo<TGanttHierarchyContext>(
    () => ({
      getRowState: (issueId) => rowStates[issueId],
      toggleRow: (issueId) => void toggleRowRef.current(issueId),
    }),
    // rowStates is rebuilt on every render; its content, in rowStatesKey, is what matters
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
    [rowStatesKey]
  );

  const nextPageResults = issues.getPaginationData(undefined, undefined)?.nextPageResults;

  const { enableIssueCreation } = issues?.viewFlags || {};

  const loadMoreIssues = useCallback(() => {
    fetchNextIssues();
  }, [fetchNextIssues]);

  const updateIssueBlockStructure = async (issue: TIssue, data: IBlockUpdateData) => {
    if (!workspaceSlug) return;

    const payload: any = { ...data };
    if (data.sort_order) payload.sort_order = data.sort_order.newSortOrder;

    updateIssue && (await updateIssue(issue.project_id, issue.id, payload));
  };

  const isAllowed = allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);
  const isManualOrder = appliedDisplayFilters?.order_by === "sort_order";
  const enableManualOrder = () => {
    if (!projectId) return;
    void updateFilters(projectId.toString(), EIssueFilterType.DISPLAY_FILTERS, { order_by: "sort_order" });
  };
  const updateBlockDates = useCallback(
    (
      updates: {
        id: string;
        start_date?: string;
        target_date?: string;
      }[]
    ) =>
      issues.updateIssueDates(workspaceSlug.toString(), updates, projectId.toString()).catch(() => {
        setToast({
          type: "error",
          title: t("toast.error"),
          message: "Error while updating work item dates, Please try again Later",
        });
      }),
    [issues, projectId, workspaceSlug]
  );

  const quickAdd =
    enableIssueCreation && isAllowed && !isCompletedCycle ? (
      <QuickAddIssueRoot
        layout={EIssueLayoutTypes.GANTT}
        QuickAddButton={GanttQuickAddIssueButton}
        containerClassName="sticky bottom-0 z-[1]"
        prePopulatedData={{
          start_date: renderFormattedPayloadDate(new Date()),
          target_date: renderFormattedPayloadDate(targetDate),
        }}
        quickAddCallback={quickAddIssue}
        isEpic={isEpic}
      />
    ) : undefined;

  return (
    <IssueLayoutHOC layout={EIssueLayoutTypes.GANTT}>
      <TimeLineTypeContext.Provider value={GANTT_TIMELINE_TYPE.ISSUE}>
        <GanttHierarchyContext.Provider value={hierarchyContext}>
          <div className="h-full w-full">
            <GanttChartRoot
              border={false}
              title={isEpic ? t("epic.label", { count: 2 }) : t("issue.label", { count: 2 })}
              loaderTitle={isEpic ? t("epic.label", { count: 2 }) : t("issue.label", { count: 2 })}
              blockIds={visibleIds}
              blockUpdateHandler={updateIssueBlockStructure}
              blockToRender={(data: TIssue) => <IssueGanttBlock issueId={data.id} isEpic={isEpic} />}
              sidebarToRender={(props) => (
                <IssueGanttSidebar
                  {...props}
                  showAllBlocks
                  isEpic={isEpic}
                  onEnableManualOrder={isAllowed && !isManualOrder ? enableManualOrder : undefined}
                />
              )}
              enableBlockLeftResize={isAllowed}
              enableBlockRightResize={isAllowed}
              enableBlockMove={isAllowed}
              enableReorder={isManualOrder && isAllowed}
              enableAddBlock={isAllowed}
              enableSelection={isBulkOperationsEnabled && isAllowed}
              quickAdd={quickAdd}
              loadMoreBlocks={loadMoreIssues}
              canLoadMoreBlocks={nextPageResults}
              updateBlockDates={updateBlockDates}
              showAllBlocks
              enableDependency
              isEpic={isEpic}
              headerActions={
                parentIds.length > 0 ? (
                  <GanttHierarchyControls
                    levelCount={levelCount}
                    expandDepth={expansion.expandDepth}
                    onShowLevels={(levels) => setExpansion(showGanttLevels(levels))}
                  />
                ) : undefined
              }
            />
          </div>
        </GanttHierarchyContext.Provider>
      </TimeLineTypeContext.Provider>
    </IssueLayoutHOC>
  );
});
