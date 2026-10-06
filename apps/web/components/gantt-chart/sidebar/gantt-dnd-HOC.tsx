/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachInstruction, extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { observer } from "mobx-react";
import { useOutsideClickDetector } from "@plane/hooks";
import { DropIndicator } from "@plane/blocks/common";
import { HIGHLIGHT_WITH_LINE, highlightIssueOnDrop } from "@/components/issues/issue-layouts/utils";

type Props = {
  id: string;
  isLastChild: boolean;
  isDragEnabled: boolean;
  children: (isDragging: boolean) => React.ReactNode;
  onDrop: (draggingBlockId: string | undefined, droppedBlockId: string | undefined, dropAtEndOfList: boolean) => void;
  /** Whether the dragged block may land above this one, or after it when it is the last row. */
  canDropBlock?: (draggingBlockId: string, droppedBlockId: string, dropAtEndOfList: boolean) => boolean;
};

export const GanttDnDHOC = observer(function GanttDnDHOC(props: Props) {
  const { id, isLastChild, children, onDrop, isDragEnabled, canDropBlock } = props;
  // states
  const [isDragging, setIsDragging] = useState(false);
  const [instruction, setInstruction] = useState<"DRAG_OVER" | "DRAG_BELOW" | undefined>(undefined);
  // refs
  const blockRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = blockRef.current;

    if (!element) return;

    const isAllowed = (sourceId: string, dropAtEndOfList: boolean) =>
      !canDropBlock || canDropBlock(sourceId, id, dropAtEndOfList);
    const getInstruction = (data: Record<string | symbol, unknown> | undefined, sourceId: string) => {
      const extractedInstruction = extractInstruction(data ?? {})?.type;
      if (!extractedInstruction) return;
      const isBelow = extractedInstruction === "reorder-below" && isLastChild;
      if (!isAllowed(sourceId, isBelow)) return;
      return isBelow ? "DRAG_BELOW" : "DRAG_OVER";
    };

    return combine(
      draggable({
        element,
        canDrag: () => isDragEnabled,
        getInitialData: () => ({ id, dragInstanceId: "GANTT_REORDER" }),
        onDragStart: () => {
          setIsDragging(true);
        },
        onDrop: () => {
          setIsDragging(false);
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => {
          const sourceId = source?.data?.id as string | undefined;
          if (!sourceId || sourceId === id || source?.data?.dragInstanceId !== "GANTT_REORDER") return false;
          return isAllowed(sourceId, false) || (isLastChild && isAllowed(sourceId, true));
        },
        getData: ({ input, element: targetElement }) => {
          const data = { id };

          // attach instruction for last in list
          return attachInstruction(data, {
            input,
            element: targetElement,
            currentLevel: 0,
            indentPerLevel: 0,
            mode: isLastChild ? "last-in-group" : "standard",
          });
        },
        onDrag: ({ self, source }) => {
          setInstruction(getInstruction(self?.data, source?.data?.id as string));
        },
        onDragLeave: () => {
          setInstruction(undefined);
        },
        onDrop: ({ self, source }) => {
          setInstruction(undefined);
          const sourceId = source?.data?.id as string | undefined;
          const destinationId = self?.data?.id as string | undefined;
          const currentInstruction = sourceId ? getInstruction(self?.data, sourceId) : undefined;
          if (!currentInstruction) return;

          onDrop(sourceId, destinationId, currentInstruction === "DRAG_BELOW");
          highlightIssueOnDrop(source?.element?.id, false, true);
        },
      })
    );
  }, [id, isDragEnabled, isLastChild, onDrop, canDropBlock]);

  useOutsideClickDetector(blockRef, () => blockRef?.current?.classList?.remove(HIGHLIGHT_WITH_LINE));

  return (
    <div id={`draggable-${id}`} className={"relative"} ref={blockRef}>
      <DropIndicator classNames="absolute top-0" isVisible={instruction === "DRAG_OVER"} />
      {children(isDragging)}
      {isLastChild && <DropIndicator isVisible={instruction === "DRAG_BELOW"} />}
    </div>
  );
});
