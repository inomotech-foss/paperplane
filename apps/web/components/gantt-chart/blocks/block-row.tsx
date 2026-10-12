/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { ArrowNarrowRightOutline } from "@makeplane/propel/icons";
// helpers
import type { IBlockUpdateData, IGanttBlock } from "@plane/types";
import { cn } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { useTimeLineChartStore } from "@/hooks/use-timeline-chart";
//
import { BLOCK_HEIGHT, SIDEBAR_RESIZE_EVENT } from "../constants";
import { getChartOffset } from "../helpers/chart-area";
import { ChartAddBlock } from "../helpers";
import { isBlockOnChart } from "../views/helpers";

type Props = {
  blockId: string;
  showAllBlocks: boolean;
  blockUpdateHandler: (block: any, payload: IBlockUpdateData) => void;
  handleScrollToBlock: (block: IGanttBlock) => void;
  enableAddBlock: boolean;
  selectionHelpers: TSelectionHelper;
  ganttContainerRef: React.RefObject<HTMLDivElement | null>;
};

export const BlockRow = observer(function BlockRow(props: Props) {
  const {
    blockId,
    showAllBlocks,
    blockUpdateHandler,
    handleScrollToBlock,
    enableAddBlock,
    selectionHelpers,
    ganttContainerRef,
  } = props;
  // states
  const [isHidden, setIsHidden] = useState(false);
  const [isBlockHiddenOnLeft, setIsBlockHiddenOnLeft] = useState(false);
  // store hooks
  const { getBlockById, updateActiveBlockId, isBlockActive } = useTimeLineChartStore();
  const { getIsIssuePeeked } = useIssueDetail();

  const block = getBlockById(blockId);

  useEffect(() => {
    const intersectionRoot = ganttContainerRef.current;
    const timelineBlock = document.getElementById(`gantt-block-${block?.id}`);
    if (!timelineBlock || !intersectionRoot) return;

    setIsBlockHiddenOnLeft(
      !!block.position?.marginLeft &&
        !!block.position?.width &&
        intersectionRoot.scrollLeft > block.position.marginLeft + block.position.width
    );

    // Observe if the block is visible on the chart, rebuilt when the sidebar width changes
    let intersectionObserver: IntersectionObserver | undefined;
    const observe = () => {
      intersectionObserver?.disconnect();
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            setIsHidden(!entry.isIntersecting);
            setIsBlockHiddenOnLeft(entry.boundingClientRect.right < (entry.rootBounds?.left ?? 0));
          });
        },
        {
          root: intersectionRoot,
          rootMargin: `0px 0px 0px -${getChartOffset(intersectionRoot)}px`,
        }
      );
      intersectionObserver.observe(timelineBlock);
    };

    observe();
    intersectionRoot.addEventListener(SIDEBAR_RESIZE_EVENT, observe);

    return () => {
      intersectionRoot.removeEventListener(SIDEBAR_RESIZE_EVENT, observe);
      intersectionObserver?.disconnect();
    };
  }, [block, ganttContainerRef]);

  // hide the block if it doesn't have start and target dates and showAllBlocks is false
  if (!block || !block.data || (!showAllBlocks && !(block.start_date && block.target_date))) return null;

  const isBlockVisibleOnChart = isBlockOnChart(block);
  const isBlockSelected = selectionHelpers.getIsEntitySelected(block.id);
  const isBlockFocused = selectionHelpers.getIsEntityActive(block.id);
  const isBlockHoveredOn = isBlockActive(block.id);

  return (
    <div
      className="relative w-max min-w-full"
      onMouseEnter={() => updateActiveBlockId(blockId)}
      onMouseLeave={() => updateActiveBlockId(null)}
      style={{
        height: `${BLOCK_HEIGHT}px`,
      }}
    >
      <div
        className={cn("relative h-full bg-layer-transparent hover:bg-layer-transparent-hover", {
          "rounded-l-sm border border-r-0 border-accent-strong": getIsIssuePeeked(block.data.id),
          "bg-layer-transparent-hover": isBlockHoveredOn,
          "bg-accent-primary/5 hover:bg-accent-primary/10": isBlockSelected,
          "bg-accent-primary/10": isBlockSelected && isBlockHoveredOn,
          "border border-r-0 border-strong-1": isBlockFocused,
        })}
      >
        {isBlockVisibleOnChart
          ? isHidden && (
              <button
                type="button"
                className="sticky left-[calc(var(--timeline-sidebar-size)_+_4px)] z-[5] grid h-8 w-8 translate-y-1.5 cursor-pointer place-items-center rounded-sm border border-strong bg-layer-1 text-secondary hover:text-primary"
                onClick={() => handleScrollToBlock(block)}
              >
                <ArrowNarrowRightOutline
                  className={cn("h-3.5 w-3.5", {
                    "rotate-180": isBlockHiddenOnLeft,
                  })}
                />
              </button>
            )
          : enableAddBlock && <ChartAddBlock block={block} blockUpdateHandler={blockUpdateHandler} />}
      </div>
    </div>
  );
});
