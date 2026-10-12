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

/** The chosen width, set on #gantt-container. */
export const SIDEBAR_WIDTH_CSS_VAR = "--timeline-sidebar-width";

/** The rendered width. 100cqw is the width of #gantt-container, which is an inline-size container. */
export const SIDEBAR_WIDTH_VAR = `clamp(${SIDEBAR_MIN_WIDTH}px, var(${SIDEBAR_WIDTH_CSS_VAR}, ${SIDEBAR_WIDTH}px), min(${SIDEBAR_MAX_WIDTH}px, 100cqw - ${SIDEBAR_MIN_CHART_WIDTH}px))`;

/** Dispatched on #gantt-container after the width is committed. */
export const SIDEBAR_RESIZE_EVENT = "timeline-sidebar-resize";

export const DEFAULT_BLOCK_WIDTH = 60;

export const GANTT_SELECT_GROUP = "gantt-issues";
