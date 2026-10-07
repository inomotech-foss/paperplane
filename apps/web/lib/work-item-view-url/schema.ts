// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { DEFAULT_TIMELINE_COLOR_BY } from "@plane/constants";
import type {
  IIssueDisplayFilterOptions,
  ILayoutDisplayFiltersOptions,
  TCalendarLayouts,
  TIssueGroupByOptions,
} from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
import type { TCodec, TDisplayPropertyScope, TViewFlag } from "./codecs";
import {
  DEFAULT_TIMELINE_ZOOM,
  calendarLayoutCodec,
  colorByCodec,
  formatCalendarAnchor,
  formatDisplayPropertyDiff,
  formatFlagDiff,
  formatRichFilters,
  groupByCodec,
  layoutCodec,
  orderByCodec,
  parseCalendarAnchor,
  parseDisplayPropertyDiff,
  parseFlagDiff,
  parseRichFilters,
  peekCodec,
  pqlCodec,
  richFiltersEqual,
  timelineZoomCodec,
} from "./codecs";
import { getLayoutOptions } from "./pages";
import type { TWorkItemPage, TWorkItemViewState } from "./types";

export type TViewParam = "l" | "g" | "sg" | "o" | "x" | "cal" | "color" | "d" | "z" | "p" | "f" | "q" | "peek";

export type TParamContext = {
  page: TWorkItemPage;
  layout: EIssueLayoutTypes | undefined;
  options: ILayoutDisplayFiltersOptions | undefined;
  calendarLayout: TCalendarLayouts;
};

export type TDecoded = { state: TWorkItemViewState; ok: boolean };

export type TViewParamSpec = {
  param: TViewParam;
  /** Where the value lives in TWorkItemViewState. */
  paths: readonly string[];
  appliesTo: (page: TWorkItemPage, layout: EIssueLayoutTypes | undefined) => boolean;
  /** Undefined omits the param. */
  encode: (state: TWorkItemViewState, baseline: TWorkItemViewState, context: TParamContext) => string | undefined;
  decode: (raw: string, state: TWorkItemViewState, context: TParamContext) => TDecoded;
};

const isLayout = (value: unknown): value is EIssueLayoutTypes =>
  typeof value === "string" && layoutCodec.parse(value)?.value === value;

export const getStateLayout = (state: TWorkItemViewState): EIssueLayoutTypes | undefined =>
  isLayout(state.displayFilters.layout) ? state.displayFilters.layout : undefined;

export const getParamContext = (page: TWorkItemPage, state: TWorkItemViewState): TParamContext => {
  const layout = getStateLayout(state);
  return {
    page,
    layout,
    options: getLayoutOptions(page, layout),
    calendarLayout: state.displayFilters.calendar?.layout ?? "month",
  };
};

const hasDisplayFilter =
  (key: keyof ILayoutDisplayFiltersOptions["display_filters"]) =>
  (page: TWorkItemPage, layout: EIssueLayoutTypes | undefined) => {
    const options = getLayoutOptions(page, layout);
    return options !== undefined && key in options.display_filters;
  };

const isLayoutOf = (target: EIssueLayoutTypes) => (page: TWorkItemPage, layout: EIssueLayoutTypes | undefined) =>
  layout === target && page.layouts.includes(target);

const flagsFor = (options: ILayoutDisplayFiltersOptions | undefined): TViewFlag[] =>
  options?.extra_options.access ? options.extra_options.values : [];

const displayScopeFor = (
  page: TWorkItemPage,
  options: ILayoutDisplayFiltersOptions | undefined
): TDisplayPropertyScope => {
  const builtIn = options?.display_properties ?? [];
  return { builtIn, custom: page.customProperties && builtIn.length > 0 };
};

type TField<T> = {
  get: (state: TWorkItemViewState) => T | undefined;
  set: (state: TWorkItemViewState, value: T) => TWorkItemViewState;
};

const displayFilterField = <K extends keyof IIssueDisplayFilterOptions>(
  key: K,
  fallback?: NonNullable<IIssueDisplayFilterOptions[K]>
): TField<NonNullable<IIssueDisplayFilterOptions[K]>> => ({
  get: (state) => state.displayFilters[key] ?? fallback,
  set: (state, value) => ({ ...state, displayFilters: { ...state.displayFilters, [key]: value } }),
});

const groupByField = (key: "group_by" | "sub_group_by"): TField<TIssueGroupByOptions> => ({
  get: (state) => state.displayFilters[key] ?? null,
  set: (state, value) => ({ ...state, displayFilters: { ...state.displayFilters, [key]: value } }),
});

type TValueParam<T> = {
  param: TViewParam;
  paths: readonly string[];
  appliesTo: TViewParamSpec["appliesTo"];
  field: TField<T>;
  codec: TCodec<T>;
  format?: (value: T, context: TParamContext) => string;
  accepts?: (value: T, context: TParamContext) => boolean;
  always?: boolean;
};

const valueParam = <T>({
  param,
  paths,
  appliesTo,
  field,
  codec,
  format = (value) => codec.format(value),
  accepts,
  always = false,
}: TValueParam<T>): TViewParamSpec => ({
  param,
  paths,
  appliesTo,
  encode: (state, baseline, context) => {
    const value = field.get(state);
    if (value === undefined) return undefined;
    const encoded = format(value, context);
    if (always) return encoded;
    const base = field.get(baseline);
    return base !== undefined && format(base, context) === encoded ? undefined : encoded;
  },
  decode: (raw, state, context) => {
    const parsed = codec.parse(raw);
    if (!parsed || (accepts && !accepts(parsed.value, context))) return { state, ok: false };
    return { state: field.set(state, parsed.value), ok: true };
  },
});

const allowedGroups = (key: "group_by" | "sub_group_by") => (value: TIssueGroupByOptions, context: TParamContext) =>
  context.options?.display_filters[key]?.includes(value) ?? false;

/** All URL params of a work item view, in canonical order. */
export const VIEW_PARAMS: readonly TViewParamSpec[] = [
  valueParam({
    param: "l",
    paths: ["displayFilters.layout"],
    appliesTo: () => true,
    field: {
      get: getStateLayout,
      set: (state, layout) => ({ ...state, displayFilters: { ...state.displayFilters, layout } }),
    },
    codec: layoutCodec,
    accepts: (layout, { page }) => page.layouts.includes(layout),
    always: true,
  }),
  valueParam({
    param: "g",
    paths: ["displayFilters.group_by"],
    appliesTo: hasDisplayFilter("group_by"),
    field: groupByField("group_by"),
    codec: groupByCodec,
    accepts: allowedGroups("group_by"),
  }),
  valueParam({
    param: "sg",
    paths: ["displayFilters.sub_group_by"],
    appliesTo: hasDisplayFilter("sub_group_by"),
    field: groupByField("sub_group_by"),
    codec: groupByCodec,
    accepts: allowedGroups("sub_group_by"),
  }),
  valueParam({
    param: "o",
    paths: ["displayFilters.order_by"],
    appliesTo: hasDisplayFilter("order_by"),
    field: displayFilterField("order_by"),
    codec: orderByCodec,
  }),
  {
    param: "x",
    paths: ["displayFilters.sub_issue", "displayFilters.show_empty_groups", "displayFilters.hierarchy"],
    appliesTo: (page, layout) => flagsFor(getLayoutOptions(page, layout)).length > 0,
    encode: (state, baseline, { options }) =>
      formatFlagDiff(state.displayFilters, baseline.displayFilters, flagsFor(options)),
    decode: (raw, state, { options }) => {
      const { values, invalid } = parseFlagDiff(raw, flagsFor(options));
      return { state: { ...state, displayFilters: { ...state.displayFilters, ...values } }, ok: invalid.length === 0 };
    },
  },
  valueParam({
    param: "cal",
    paths: ["displayFilters.calendar.layout"],
    appliesTo: isLayoutOf(EIssueLayoutTypes.CALENDAR),
    field: {
      get: (state) => state.displayFilters.calendar?.layout ?? "month",
      set: (state, layout) => ({
        ...state,
        displayFilters: { ...state.displayFilters, calendar: { ...state.displayFilters.calendar, layout } },
      }),
    },
    codec: calendarLayoutCodec,
  }),
  valueParam({
    param: "color",
    paths: ["displayFilters.color_by"],
    appliesTo: hasDisplayFilter("color_by"),
    field: displayFilterField("color_by", DEFAULT_TIMELINE_COLOR_BY),
    codec: colorByCodec,
  }),
  valueParam({
    param: "d",
    paths: ["calendarAnchor"],
    appliesTo: isLayoutOf(EIssueLayoutTypes.CALENDAR),
    field: {
      get: (state) => state.calendarAnchor,
      set: (state, calendarAnchor) => ({ ...state, calendarAnchor }),
    },
    codec: { parse: parseCalendarAnchor, format: (anchor) => anchor },
    format: (anchor, { calendarLayout }) => formatCalendarAnchor(anchor, calendarLayout),
  }),
  valueParam({
    param: "z",
    paths: ["timelineZoom"],
    appliesTo: isLayoutOf(EIssueLayoutTypes.GANTT),
    field: {
      get: (state) => state.timelineZoom ?? DEFAULT_TIMELINE_ZOOM,
      set: (state, timelineZoom) => ({ ...state, timelineZoom }),
    },
    codec: timelineZoomCodec,
  }),
  {
    param: "p",
    paths: ["displayProperties"],
    appliesTo: (page, layout) => displayScopeFor(page, getLayoutOptions(page, layout)).builtIn.length > 0,
    encode: (state, baseline, { page, options }) =>
      formatDisplayPropertyDiff(state.displayProperties, baseline.displayProperties, displayScopeFor(page, options)),
    decode: (raw, state, { page, options }) => {
      const { values, invalid } = parseDisplayPropertyDiff(raw, displayScopeFor(page, options));
      return {
        state: { ...state, displayProperties: { ...state.displayProperties, ...values } },
        ok: invalid.length === 0,
      };
    },
  },
  {
    param: "f",
    paths: ["richFilters"],
    appliesTo: () => true,
    encode: (state, baseline) =>
      richFiltersEqual(state.richFilters, baseline.richFilters) ? undefined : formatRichFilters(state.richFilters),
    decode: (raw, state) => {
      const parsed = parseRichFilters(raw);
      return parsed ? { state: { ...state, richFilters: parsed.value }, ok: true } : { state, ok: false };
    },
  },
  valueParam({
    param: "q",
    paths: ["displayFilters.pql"],
    appliesTo: (page) => page.pql,
    field: displayFilterField("pql", ""),
    codec: pqlCodec,
  }),
  valueParam({
    param: "peek",
    paths: ["peek"],
    appliesTo: () => true,
    field: {
      get: (state) => state.peek,
      set: (state, peek) => ({ ...state, peek }),
    },
    codec: peekCodec,
  }),
];

export const VIEW_PARAM_NAMES: ReadonlySet<string> = new Set(VIEW_PARAMS.map(({ param }) => param));
