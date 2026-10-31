/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import type { IGanttBlock } from "@plane/types";
import type { TGanttBlockUpdateHandler, TGanttEnableFlag } from "@/components/gantt-chart/types";
import RenderIfVisible from "@/components/core/render-if-visible-HOC";
// hooks
import { BlockRow } from "@/components/gantt-chart/blocks/block-row";
import { BLOCK_HEIGHT } from "@/components/gantt-chart/constants";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// types

export type GanttChartBlocksProps = {
  blockIds: string[];
  blockUpdateHandler: TGanttBlockUpdateHandler;
  handleScrollToBlock: (block: IGanttBlock) => void;
  enableAddBlock: TGanttEnableFlag;
  showAllBlocks: boolean;
  selectionHelpers: TSelectionHelper;
  ganttContainerRef: React.RefObject<HTMLDivElement | null>;
};

export function GanttChartRowList(props: GanttChartBlocksProps) {
  const {
    blockIds,
    blockUpdateHandler,
    handleScrollToBlock,
    enableAddBlock,
    showAllBlocks,
    selectionHelpers,
    ganttContainerRef,
  } = props;

  return (
    <div className="absolute top-0 left-0 w-max min-w-full">
      {blockIds?.map((blockId) => (
        <RenderIfVisible
          key={blockId}
          root={ganttContainerRef}
          horizontalOffset={100}
          verticalOffset={200}
          classNames="relative min-w-full w-max"
          placeholderChildren={<div className="pointer-events-none w-full" style={{ height: `${BLOCK_HEIGHT}px` }} />}
          shouldRecordHeights={false}
        >
          <BlockRow
            blockId={blockId}
            showAllBlocks={showAllBlocks}
            blockUpdateHandler={blockUpdateHandler}
            handleScrollToBlock={handleScrollToBlock}
            enableAddBlock={typeof enableAddBlock === "function" ? enableAddBlock(blockId) : enableAddBlock}
            selectionHelpers={selectionHelpers}
            ganttContainerRef={ganttContainerRef}
          />
        </RenderIfVisible>
      ))}
    </div>
  );
}
