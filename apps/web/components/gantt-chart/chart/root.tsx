/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { createPortal } from "react-dom";
// plane imports
// components
import type { ChartDataType, IBlockUpdateDependencyData, TGanttViews } from "@plane/types";
import { cn } from "@plane/utils";
import { GanttChartHeader, GanttChartMainContent } from "@/components/gantt-chart";
// helpers
// hooks
import { useUserProfile } from "@/hooks/store/user";
import { useTimeLineChartStore } from "@/hooks/use-timeline-chart";
//
import { currentViewDataWithView } from "../data";
import { getChartOffset } from "../helpers/chart-area";
import type { TGanttBlockUpdateHandler, TGanttEnableFlag, TGanttRenderBlockData, TGanttSidebarProps } from "../types";
import { getNumberOfDaysBetweenTwoDates, mergeRenderPayloads, monthView, quarterView, weekView } from "../views";

type ChartViewRootProps = {
  border: boolean;
  title: string;
  loaderTitle: string;
  blockIds: string[];
  blockUpdateHandler: TGanttBlockUpdateHandler;
  blockToRender: (data: TGanttRenderBlockData) => React.ReactNode;
  sidebarToRender: (props: TGanttSidebarProps) => React.ReactNode;
  enableBlockLeftResize: TGanttEnableFlag;
  enableBlockRightResize: TGanttEnableFlag;
  enableBlockMove: TGanttEnableFlag;
  enableReorder: TGanttEnableFlag;
  enableAddBlock: TGanttEnableFlag;
  enableSelection: TGanttEnableFlag;
  enableDependency: TGanttEnableFlag;
  bottomSpacing: boolean;
  showAllBlocks: boolean;
  loadMoreBlocks?: () => void;
  updateBlockDates?: (updates: IBlockUpdateDependencyData[]) => Promise<void>;
  canLoadMoreBlocks?: boolean;
  quickAdd?: React.ReactNode | undefined;
  showToday: boolean;
  /** Extra controls shown in the chart header, e.g. expand / collapse of the hierarchy. */
  headerActions?: React.ReactNode;
};

const timelineViewHelpers = {
  week: weekView,
  month: monthView,
  quarter: quarterView,
};

export const ChartViewRoot = observer(function ChartViewRoot(props: ChartViewRootProps) {
  const {
    border,
    title,
    blockIds,
    loadMoreBlocks,
    loaderTitle,
    blockUpdateHandler,
    sidebarToRender,
    blockToRender,
    canLoadMoreBlocks,
    enableBlockLeftResize,
    enableBlockRightResize,
    enableBlockMove,
    enableReorder,
    enableAddBlock,
    enableSelection,
    enableDependency,
    bottomSpacing,
    showAllBlocks,
    quickAdd,
    showToday,
    updateBlockDates,
    headerActions,
  } = props;
  // states
  const [itemsContainerWidth, setItemsContainerWidth] = useState(0);
  const [fullScreenMode, setFullScreenMode] = useState(false);
  // hooks
  const chartStore = useTimeLineChartStore();
  const {
    currentView,
    currentViewData,
    updateCurrentView,
    updateCurrentViewData,
    updateRenderView,
    updateAllBlocksOnChartChangeWhileDragging,
  } = chartStore;
  const { data } = useUserProfile();
  const startOfWeek = data?.start_of_the_week;

  const updateCurrentViewRenderPayload = (side: null | "left" | "right", view: TGanttViews, targetDate?: Date) => {
    const selectedCurrentView: TGanttViews = view;
    const selectedCurrentViewData: ChartDataType | undefined =
      selectedCurrentView && selectedCurrentView === currentViewData?.key
        ? currentViewData
        : currentViewDataWithView(view);

    if (selectedCurrentViewData === undefined) return;

    const currentViewHelpers = timelineViewHelpers[selectedCurrentView];
    const currentRender = currentViewHelpers.generateChart(selectedCurrentViewData, side, targetDate, startOfWeek);

    // updating the prevData, currentData and nextData
    if (currentRender.payload) {
      updateCurrentViewData(currentRender.state);

      if (side === "left") {
        updateCurrentView(selectedCurrentView);
        updateRenderView(
          mergeRenderPayloads(selectedCurrentView, currentRender.payload, chartStore.renderView) ??
            currentRender.payload
        );
        if (!targetDate) updateCurrentLeftScrollPosition(currentRender.scrollWidth);
        updateAllBlocksOnChartChangeWhileDragging(currentRender.scrollWidth);
        setItemsContainerWidth((prevWidth) => prevWidth + currentRender.scrollWidth);
      } else if (side === "right") {
        updateCurrentView(view);
        updateRenderView(
          mergeRenderPayloads(view, chartStore.renderView, currentRender.payload) ?? currentRender.payload
        );
        setItemsContainerWidth((prevWidth) => prevWidth + currentRender.scrollWidth);
      } else {
        updateCurrentView(view);
        updateRenderView(currentRender.payload);
        setItemsContainerWidth(currentRender.scrollWidth);
        setTimeout(() => {
          handleScrollToCurrentSelectedDate(currentRender.state, currentRender.state.data.currentDate);
        }, 50);
      }
    }

    return currentRender.state;
  };

  const handleToday = () => updateCurrentViewRenderPayload(null, currentView);

  // handling the scroll positioning from left and right
  useEffect(() => {
    handleToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCurrentLeftScrollPosition = (width: number) => {
    const scrollContainer = document.getElementById("gantt-container");
    if (!scrollContainer) return;

    scrollContainer.scrollLeft = width + scrollContainer.scrollLeft;
  };

  const handleScrollToCurrentSelectedDate = (currentState: ChartDataType, date: Date) => {
    const scrollContainer = document.getElementById("gantt-container");
    if (!scrollContainer) return;

    const chartOffset = getChartOffset(scrollContainer);
    const clientVisibleWidth: number = scrollContainer.clientWidth;
    let scrollWidth: number = 0;
    let daysDifference: number = 0;
    daysDifference = getNumberOfDaysBetweenTwoDates(currentState.data.startDate, date);

    scrollWidth =
      Math.abs(daysDifference) * currentState.data.dayWidth -
      (clientVisibleWidth / 2 - currentState.data.dayWidth) +
      chartOffset / 2;

    scrollContainer.scrollLeft = scrollWidth;
  };

  const portalContainer =
    fullScreenMode && typeof document !== "undefined" ? document.getElementById("full-screen-portal") : null;

  const content = (
    <div
      className={cn("shadow relative flex h-full flex-col rounded-xs bg-surface-1 select-none", {
        "inset-0 z-[25] bg-surface-1": fullScreenMode,
        "border-[0.5px] border-subtle": border,
      })}
    >
      <GanttChartHeader
        blockIds={blockIds}
        fullScreenMode={fullScreenMode}
        toggleFullScreenMode={() => setFullScreenMode((prevData) => !prevData)}
        handleChartView={(key) => updateCurrentViewRenderPayload(null, key)}
        handleToday={handleToday}
        loaderTitle={loaderTitle}
        showToday={showToday}
        actions={headerActions}
      />
      <GanttChartMainContent
        blockIds={blockIds}
        loadMoreBlocks={loadMoreBlocks}
        canLoadMoreBlocks={canLoadMoreBlocks}
        blockToRender={blockToRender}
        blockUpdateHandler={blockUpdateHandler}
        bottomSpacing={bottomSpacing}
        enableBlockLeftResize={enableBlockLeftResize}
        enableBlockMove={enableBlockMove}
        enableBlockRightResize={enableBlockRightResize}
        enableReorder={enableReorder}
        enableSelection={enableSelection}
        enableAddBlock={enableAddBlock}
        enableDependency={enableDependency}
        itemsContainerWidth={itemsContainerWidth}
        showAllBlocks={showAllBlocks}
        sidebarToRender={sidebarToRender}
        title={title}
        updateCurrentViewRenderPayload={updateCurrentViewRenderPayload}
        quickAdd={quickAdd}
        updateBlockDates={updateBlockDates}
      />
    </div>
  );

  return fullScreenMode && portalContainer ? createPortal(content, portalContainer) : content;
});
