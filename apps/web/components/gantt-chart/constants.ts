/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const BLOCK_HEIGHT = 44;

export const HEADER_HEIGHT = 48;

export const GANTT_BREADCRUMBS_HEIGHT = 40;

export const SIDEBAR_WIDTH = 360;

export const SIDEBAR_MIN_WIDTH = 240;

export const SIDEBAR_MAX_WIDTH = 720;

export const SIDEBAR_MIN_CHART_WIDTH = 240;

export const SIDEBAR_WIDTH_STORAGE_KEY = "timeline_sidebar_width";

/** The width the user chose. The resize handle sets it on #gantt-container. */
export const SIDEBAR_WIDTH_PROPERTY = "--timeline-sidebar-width";

/** The rendered width, declared on #gantt-container. Layout reads it with `var(--timeline-sidebar-size)`. */
export const SIDEBAR_SIZE_PROPERTY = "--timeline-sidebar-size";

/**
 * Clamps the chosen width so the chart keeps its room. #gantt-container is an inline-size
 * container, so `100cqw` resolves to its width on the descendants that use the property.
 */
export const SIDEBAR_SIZE_VALUE = `clamp(${SIDEBAR_MIN_WIDTH}px, var(${SIDEBAR_WIDTH_PROPERTY}, ${SIDEBAR_WIDTH}px), min(${SIDEBAR_MAX_WIDTH}px, 100cqw - ${SIDEBAR_MIN_CHART_WIDTH}px))`;

/** The upper bound SIDEBAR_SIZE_VALUE applies in a container of this width. */
export const getSidebarMaxWidth = (containerWidth: number) =>
  Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, containerWidth - SIDEBAR_MIN_CHART_WIDTH));

/** Dispatched on #gantt-container once a change of the rendered width settles. */
export const SIDEBAR_RESIZE_EVENT = "timeline-sidebar-resize";

declare module "react" {
  interface CSSProperties {
    [SIDEBAR_SIZE_PROPERTY]?: string;
  }
}

export const DEFAULT_BLOCK_WIDTH = 60;

export const GANTT_SELECT_GROUP = "gantt-issues";
