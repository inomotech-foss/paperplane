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
  isBuiltInDisplayProperty,
  isCustomDisplayPropertyKey,
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
import { getLayoutOptions, isLayout, isPageLayout } from "./pages";
import type { TCalendarClock, TStatePath, TWorkItemPage, TWorkItemViewState } from "./types";

export type TViewParam = "l" | "g" | "sg" | "o" | "x" | "cal" | "color" | "d" | "z" | "p" | "f" | "q" | "peek";

export type TParamContext = {
  page: TWorkItemPage;
  layout: EIssueLayoutTypes | undefined;
  options: ILayoutDisplayFiltersOptions | undefined;
  calendarLayout: TCalendarLayouts;
};

export type TEncodeContext = TParamContext & { clock: TCalendarClock };

export type TDecoded = { state: TWorkItemViewState; ok: boolean };

/** Applies a parsed param to a state; `ok` is false if parts did not apply. */
export type TApplyParam = (state: TWorkItemViewState, context: TParamContext) => TDecoded;

export type TViewParamSpec = {
  param: TViewParam;
  /** The state fields the param owns on this page and layout; none means it does not apply. */
  paths: (page: TWorkItemPage, layout: EIssueLayoutTypes | undefined) => readonly TStatePath[];
  /** Undefined omits the param. */
  encode: (state: TWorkItemViewState, baseline: TWorkItemViewState, context: TEncodeContext) => string | undefined;
  /** Parses without a baseline; undefined if invalid. */
  parse: (raw: string, page: TWorkItemPage) => TApplyParam | undefined;
};

export const getStateLayout = (page: TWorkItemPage, state: TWorkItemViewState): EIssueLayoutTypes | undefined =>
  isPageLayout(page, state.displayFilters.layout) ? state.displayFilters.layout : undefined;

export const getParamContext = (page: TWorkItemPage, state: TWorkItemViewState): TParamContext => {
  const layout = getStateLayout(page, state);
  return {
    page,
    layout,
    options: getLayoutOptions(page, layout),
    calendarLayout: state.displayFilters.calendar?.layout ?? "month",
  };
};

const flagsFor = (options: ILayoutDisplayFiltersOptions | undefined): TViewFlag[] =>
  options?.extra_options.access ? options.extra_options.values : [];

const displayScopeFor = (
  page: TWorkItemPage,
  options: ILayoutDisplayFiltersOptions | undefined
): TDisplayPropertyScope => {
  const builtIn = (options?.display_properties ?? []).filter(isBuiltInDisplayProperty);
  return { builtIn, custom: page.customProperties && builtIn.length > 0 };
};

const pathsIf =
  (paths: readonly TStatePath[], applies: (page: TWorkItemPage, layout: EIssueLayoutTypes | undefined) => boolean) =>
  (page: TWorkItemPage, layout: EIssueLayoutTypes | undefined) =>
    applies(page, layout) ? paths : [];

const hasDisplayFilter =
  (key: keyof ILayoutDisplayFiltersOptions["display_filters"]) =>
  (page: TWorkItemPage, layout: EIssueLayoutTypes | undefined) => {
    const options = getLayoutOptions(page, layout);
    return options !== undefined && key in options.display_filters;
  };

const isLayoutOf = (target: EIssueLayoutTypes) => (page: TWorkItemPage, layout: EIssueLayoutTypes | undefined) =>
  layout === target && page.layouts.includes(target);

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
  paths: TViewParamSpec["paths"];
  field: TField<T>;
  codec: TCodec<T>;
  format?: (value: T, context: TEncodeContext) => string;
  /** The value encoded for the baseline; defaults to the baseline's value. */
  reference?: (baseline: TWorkItemViewState, context: TEncodeContext) => string | undefined;
  acceptsParsed?: (value: T, page: TWorkItemPage) => boolean;
  acceptsApplied?: (value: T, context: TParamContext) => boolean;
  always?: boolean;
};

const valueParam = <T>({
  param,
  paths,
  field,
  codec,
  format = (value) => codec.format(value),
  reference,
  acceptsParsed,
  acceptsApplied,
  always = false,
}: TValueParam<T>): TViewParamSpec => ({
  param,
  paths,
  encode: (state, baseline, context) => {
    const value = field.get(state);
    if (value === undefined) return undefined;
    const encoded = format(value, context);
    if (always) return encoded;
    const base = field.get(baseline);
    const baseEncoded = reference
      ? reference(baseline, context)
      : base === undefined
        ? undefined
        : format(base, context);
    return baseEncoded === encoded ? undefined : encoded;
  },
  parse: (raw, page) => {
    const parsed = codec.parse(raw);
    if (!parsed || (acceptsParsed && !acceptsParsed(parsed.value, page))) return undefined;
    const { value } = parsed;
    return (state, context) =>
      acceptsApplied && !acceptsApplied(value, context)
        ? { state, ok: false }
        : { state: field.set(state, value), ok: true };
  },
});

const allowedGroups = (key: "group_by" | "sub_group_by") => (value: TIssueGroupByOptions, context: TParamContext) =>
  context.options?.display_filters[key]?.includes(value) ?? false;

/** All URL params of a work item view, in canonical order. */
export const VIEW_PARAMS: readonly TViewParamSpec[] = [
  valueParam({
    param: "l",
    paths: () => ["displayFilters.layout"],
    field: {
      get: (state) => (isLayout(state.displayFilters.layout) ? state.displayFilters.layout : undefined),
      set: (state, layout) => ({ ...state, displayFilters: { ...state.displayFilters, layout } }),
    },
    codec: layoutCodec,
    acceptsParsed: (layout, page) => page.layouts.includes(layout),
    always: true,
  }),
  valueParam({
    param: "g",
    paths: pathsIf(["displayFilters.group_by"], hasDisplayFilter("group_by")),
    field: groupByField("group_by"),
    codec: groupByCodec,
    acceptsApplied: allowedGroups("group_by"),
  }),
  valueParam({
    param: "sg",
    paths: pathsIf(["displayFilters.sub_group_by"], hasDisplayFilter("sub_group_by")),
    field: groupByField("sub_group_by"),
    codec: groupByCodec,
    acceptsApplied: allowedGroups("sub_group_by"),
  }),
  valueParam({
    param: "o",
    paths: pathsIf(["displayFilters.order_by"], hasDisplayFilter("order_by")),
    field: displayFilterField("order_by"),
    codec: orderByCodec,
  }),
  {
    param: "x",
    paths: (page, layout) =>
      flagsFor(getLayoutOptions(page, layout)).map((flag): TStatePath => `displayFilters.${flag}`),
    encode: (state, baseline, { options }) =>
      formatFlagDiff(state.displayFilters, baseline.displayFilters, flagsFor(options)),
    parse: (raw) => {
      const { values, invalid } = parseFlagDiff(raw);
      return (state, { options }) => {
        const flags = flagsFor(options);
        const applicable = new Set<string>(flags);
        const displayFilters = { ...state.displayFilters };
        for (const flag of flags) {
          const value = values[flag];
          if (value !== undefined) displayFilters[flag] = value;
        }
        const ok = invalid.length === 0 && Object.keys(values).every((flag) => applicable.has(flag));
        return { state: { ...state, displayFilters }, ok };
      };
    },
  },
  valueParam({
    param: "cal",
    paths: pathsIf(["displayFilters.calendar.layout"], isLayoutOf(EIssueLayoutTypes.CALENDAR)),
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
    paths: pathsIf(["displayFilters.color_by"], hasDisplayFilter("color_by")),
    // baselines omit the default color_by while the store may hold "state": compare toSearch output, not states
    field: displayFilterField("color_by", DEFAULT_TIMELINE_COLOR_BY),
    codec: colorByCodec,
  }),
  valueParam({
    param: "d",
    paths: pathsIf(["calendarAnchor"], isLayoutOf(EIssueLayoutTypes.CALENDAR)),
    field: {
      get: (state) => state.calendarAnchor,
      set: (state, calendarAnchor) => ({ ...state, calendarAnchor }),
    },
    codec: { parse: parseCalendarAnchor, format: (anchor) => anchor },
    format: (anchor, { calendarLayout, clock }) => formatCalendarAnchor(anchor, calendarLayout, clock.weekStart),
    reference: (_, { calendarLayout, clock }) => formatCalendarAnchor(clock.today, calendarLayout, clock.weekStart),
  }),
  valueParam({
    param: "z",
    paths: pathsIf(["timelineZoom"], isLayoutOf(EIssueLayoutTypes.GANTT)),
    field: {
      get: (state) => state.timelineZoom ?? DEFAULT_TIMELINE_ZOOM,
      set: (state, timelineZoom) => ({ ...state, timelineZoom }),
    },
    codec: timelineZoomCodec,
    reference: () => DEFAULT_TIMELINE_ZOOM,
  }),
  {
    param: "p",
    paths: (page, layout) => {
      const scope = displayScopeFor(page, getLayoutOptions(page, layout));
      const paths: TStatePath[] = scope.builtIn.map((key): TStatePath => `displayProperties.${key}`);
      if (scope.custom) paths.push("displayProperties.custom_property_*");
      return paths;
    },
    encode: (state, baseline, { page, options }) =>
      formatDisplayPropertyDiff(state.displayProperties, baseline.displayProperties, displayScopeFor(page, options)),
    parse: (raw) => {
      const { values, invalid } = parseDisplayPropertyDiff(raw);
      return (state, { page, options }) => {
        const scope = displayScopeFor(page, options);
        const builtIn = new Set<string>(scope.builtIn);
        const displayProperties = { ...state.displayProperties };
        let ok = invalid.length === 0;
        for (const [key, value] of Object.entries(values)) {
          if (value === undefined) continue;
          if (isBuiltInDisplayProperty(key) && builtIn.has(key)) displayProperties[key] = value;
          else if (isCustomDisplayPropertyKey(key) && scope.custom) displayProperties[key] = value;
          else ok = false;
        }
        return { state: { ...state, displayProperties }, ok };
      };
    },
  },
  {
    param: "f",
    paths: () => ["richFilters"],
    encode: (state, baseline) =>
      richFiltersEqual(state.richFilters, baseline.richFilters) ? undefined : formatRichFilters(state.richFilters),
    parse: (raw) => {
      const parsed = parseRichFilters(raw);
      if (!parsed) return undefined;
      return (state) => ({ state: { ...state, richFilters: parsed.value }, ok: true });
    },
  },
  valueParam({
    param: "q",
    paths: (page) => (page.pql ? ["displayFilters.pql"] : []),
    field: displayFilterField("pql", ""),
    codec: pqlCodec,
  }),
  valueParam({
    param: "peek",
    paths: () => ["peek"],
    field: {
      get: (state) => state.peek,
      set: (state, peek) => ({ ...state, peek }),
    },
    codec: peekCodec,
  }),
];

export const VIEW_PARAM_NAMES: ReadonlySet<string> = new Set(VIEW_PARAMS.map(({ param }) => param));

/** The state fields the URL owns on a page and layout; apply only these from a parsed URL. */
export const getApplicablePaths = (page: TWorkItemPage, layout: EIssueLayoutTypes | undefined): TStatePath[] =>
  VIEW_PARAMS.flatMap((spec) => spec.paths(page, layout));
