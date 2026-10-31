/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { RefObject } from "react";
import type { IBlockUpdateData, TGanttBlockData } from "@plane/types";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";

export type TGanttBlockUpdateHandler = (block: TGanttBlockData, payload: IBlockUpdateData) => void;

export type TGanttRenderBlockData = TGanttBlockData & { meta?: Record<string, unknown> };

export type TGanttEnableFlag = boolean | ((blockId: string) => boolean);

export const resolveGanttFlag = (flag: TGanttEnableFlag, blockId: string): boolean =>
  typeof flag === "function" ? flag(blockId) : flag;

export type TGanttSidebarProps = {
  title: string;
  blockUpdateHandler: TGanttBlockUpdateHandler;
  blockIds: string[];
  enableReorder: TGanttEnableFlag;
  enableSelection: TGanttEnableFlag;
  canLoadMoreBlocks?: boolean;
  ganttContainerRef: RefObject<HTMLDivElement | null>;
  loadMoreBlocks?: () => void;
  selectionHelpers: TSelectionHelper;
  showAllBlocks?: boolean;
};
