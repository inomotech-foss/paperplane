/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TGanttViews } from "@plane/types";
import { isRecord } from "@plane/types";
import type { IMonthBlock, IMonthView } from "./month-view";
import { monthView } from "./month-view";
import { quarterView } from "./quarter-view";
import type { IWeekBlock } from "./week-view";
import { weekView } from "./week-view";

export type TGanttRenderView = IWeekBlock[] | IMonthView | IMonthBlock[];

const GANTT_VIEWS: readonly TGanttViews[] = ["week", "month", "quarter"];

export const isGanttView = (value: string): value is TGanttViews => GANTT_VIEWS.some((view) => view === value);

const isWeekBlock = (value: unknown): value is IWeekBlock =>
  isRecord(value) &&
  value.startDate instanceof Date &&
  value.endDate instanceof Date &&
  typeof value.weekNumber === "number" &&
  typeof value.title === "string";

const isMonthBlock = (value: unknown): value is IMonthBlock =>
  isRecord(value) &&
  typeof value.month === "number" &&
  typeof value.year === "number" &&
  typeof value.days === "number" &&
  typeof value.title === "string";

export const isWeekBlockList = (value: unknown): value is IWeekBlock[] =>
  Array.isArray(value) && value.every(isWeekBlock);

export const isMonthBlockList = (value: unknown): value is IMonthBlock[] =>
  Array.isArray(value) && value.every(isMonthBlock);

export const isMonthView = (value: unknown): value is IMonthView =>
  isRecord(value) && isMonthBlockList(value.months) && isWeekBlockList(value.weeks);

/** Merges two render payloads of a view, or returns undefined when either does not match the view. */
export const mergeRenderPayloads = (view: TGanttViews, a: unknown, b: unknown): TGanttRenderView | undefined => {
  switch (view) {
    case "week":
      return isWeekBlockList(a) && isWeekBlockList(b) ? weekView.mergeRenderPayloads(a, b) : undefined;
    case "month":
      return isMonthView(a) && isMonthView(b) ? monthView.mergeRenderPayloads(a, b) : undefined;
    case "quarter":
      return isMonthBlockList(a) && isMonthBlockList(b) ? quarterView.mergeRenderPayloads(a, b) : undefined;
  }
};
