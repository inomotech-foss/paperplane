/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { RefObject } from "react";
import { observer } from "mobx-react";
// hooks
import { useAutoScroller } from "@/hooks/use-auto-scroller";
import { useTimeLineChartStore } from "@/hooks/use-timeline-chart";
//
import { HEADER_HEIGHT } from "../constants";
import { useTimelineSidebarWidth } from "../contexts/sidebar-width";

type Props = {
  ganttContainerRef: RefObject<HTMLDivElement | null>;
};
export const TimelineDragHelper = observer(function TimelineDragHelper(props: Props) {
  const { ganttContainerRef } = props;
  const { isDragging } = useTimeLineChartStore();
  const sidebarWidth = useTimelineSidebarWidth();

  useAutoScroller(ganttContainerRef, isDragging, sidebarWidth, HEADER_HEIGHT);
  return <></>;
});
