// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { ISSUE_DISPLAY_PROPERTIES_KEYS } from "@plane/constants";
import type {
  IIssueDisplayFilterOptions,
  TCalendarLayouts,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
  TWorkItemFilterExpression,
} from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType, EStartOfTheWeek } from "@plane/types";
import { getComputedDisplayProperties, getDisplayFilterCorrections } from "@plane/utils";
import { formatRichFilters } from "./codecs";
import { getLayoutOptions, getPageBaseline, getWorkItemPage } from "./pages";
import type { TWorkItemPageStoreType } from "./pages";
import { VIEW_PARAMS, getApplicablePaths } from "./schema";
import { fromSearch, mergeSearch, normalizeViewState, parseSearch, toSearch } from "./serialize";
import type { TCalendarClock, TSavedViewConfig, TWorkItemPage, TWorkItemViewState } from "./types";

const CP = "0b5c6a3e-8f1d-4c2a-9e7b-1a2b3c4d5e6f";
const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
// a Wednesday
const CLOCK: TCalendarClock = { today: "2026-10-07", weekStart: EStartOfTheWeek.MONDAY };

const project = getWorkItemPage(EIssuesStoreType.PROJECT);
const projectBaseline = getPageBaseline(project);

const withFilters = (state: TWorkItemViewState, displayFilters: IIssueDisplayFilterOptions): TWorkItemViewState => ({
  ...state,
  displayFilters: { ...state.displayFilters, ...displayFilters },
});

/** Decoded query string, for readable expectations. */
const plain = (params: URLSearchParams) => [...params].map(([key, value]) => `${key}=${value}`).join("&");

const encode = (
  state: TWorkItemViewState,
  baseline: TWorkItemViewState = projectBaseline,
  page: TWorkItemPage = project,
  clock: TCalendarClock = CLOCK
) => plain(toSearch(state, baseline, page, { clock }));

const canonical = (
  query: string,
  storeType: TWorkItemPageStoreType = EIssuesStoreType.PROJECT,
  view?: TSavedViewConfig
) => {
  const page = getWorkItemPage(storeType);
  const baseline = getPageBaseline(page, view);
  const params = new URLSearchParams(query);
  const result = fromSearch(params, baseline, page);
  return { ...result, query: plain(toSearch(result.state, baseline, page, { clock: CLOCK, current: params })) };
};

const JSON_FILTERS = formatRichFilters({ and: [{ name__icontains: "fix: a; b, c" }, { not: { state_id__in: S1 } }] });

describe("explicit marker", () => {
  it("treats no params as plain navigation", () => {
    const result = fromSearch(new URLSearchParams(), projectBaseline, project);
    expect(result).toEqual({ explicit: false, state: projectBaseline, invalid: [] });
  });

  it("always writes l", () => {
    expect(encode(projectBaseline)).toBe("l=list");
  });

  it.each([
    ["no layout", undefined],
    ["a layout the page does not render", EIssueLayoutTypes.KANBAN],
  ])("writes the baseline layout for %s", (_, layout) => {
    const archived = getWorkItemPage(EIssuesStoreType.ARCHIVED);
    const state = withFilters(getPageBaseline(archived), { layout });
    expect(encode(state, getPageBaseline(archived), archived)).toBe("l=list");
  });

  it.each([
    ["peek=WEB-1", false],
    ["foo=bar", false],
    ["g=priority", true],
    ["l=list", true],
    ["l=grid", true],
  ])("%s is explicit: %s", (query, explicit) => {
    expect(fromSearch(new URLSearchParams(query), projectBaseline, project).explicit).toBe(explicit);
  });

  it("applies only peek without view params", () => {
    const result = fromSearch(new URLSearchParams("peek=WEB-1&foo=bar"), projectBaseline, project);
    expect(result.state).toEqual({ ...projectBaseline, peek: { projectIdentifier: "WEB", sequenceId: 1 } });
    expect(result.invalid).toEqual([]);
  });

  it("adds l to view params without it", () => {
    expect(canonical("g=priority").query).toBe("l=list&g=priority");
  });
});

describe("parse and merge", () => {
  it("parses before the baseline is known", () => {
    const parsed = parseSearch(new URLSearchParams("l=kanban&g=labels&peek=WEB-1"), project);
    expect(parsed.explicit).toBe(true);
    expect(parsed.params.map(({ param }) => param)).toEqual(["l", "g", "peek"]);

    const page = getWorkItemPage(EIssuesStoreType.PROJECT_VIEW);
    const plainView = mergeSearch(parsed, getPageBaseline(page), page).state;
    const groupedView = mergeSearch(
      parsed,
      getPageBaseline(page, { display_filters: { layout: EIssueLayoutTypes.KANBAN, sub_group_by: "priority" } }),
      page
    ).state;
    expect(plainView.displayFilters).toMatchObject({ layout: "kanban", group_by: "labels", sub_group_by: null });
    expect(groupedView.displayFilters).toMatchObject({ group_by: "labels", sub_group_by: "priority" });
  });

  it("reports syntax errors while parsing and layout errors while merging", () => {
    const parsed = parseSearch(new URLSearchParams("l=list&g=bogus&sg=labels"), project);
    expect(parsed.invalid).toEqual([{ param: "g", value: "bogus" }]);
    expect(mergeSearch(parsed, projectBaseline, project).invalid).toEqual([
      { param: "g", value: "bogus" },
      { param: "sg", value: "labels" },
    ]);
  });
});

describe("round trips", () => {
  const view: TSavedViewConfig = {
    display_filters: { group_by: "priority", show_empty_groups: true, pql: "priority = high" },
    rich_filters: { state_id__in: S1 },
  };

  it.each<[string, TWorkItemPageStoreType]>([
    ["l=list", EIssuesStoreType.PROJECT],
    ["l=list&g=priority", EIssuesStoreType.PROJECT],
    ["l=list&g=none", EIssuesStoreType.PROJECT_VIEW],
    ["l=kanban&g=state", EIssuesStoreType.PROJECT],
    ["l=kanban&g=priority&sg=labels", EIssuesStoreType.CYCLE],
    ["l=list&g=state_group", EIssuesStoreType.PROFILE],
    ["l=list&o=-priority", EIssuesStoreType.MODULE],
    ["l=table&o=-state__name", EIssuesStoreType.PROJECT],
    ["l=list&x=empty,sub", EIssuesStoreType.PROJECT],
    ["l=table&x=sub,tree", EIssuesStoreType.PROJECT],
    ["l=list&x=-empty", EIssuesStoreType.PROJECT_VIEW],
    ["l=calendar&cal=week", EIssuesStoreType.PROJECT],
    ["l=calendar&d=2026-11", EIssuesStoreType.PROJECT],
    ["l=calendar&cal=week&d=2026-10-12", EIssuesStoreType.PROJECT],
    ["l=timeline&color=key", EIssuesStoreType.PROJECT],
    ["l=timeline&z=quarter", EIssuesStoreType.PROJECT],
    ["l=list&p=-estimate,-labels", EIssuesStoreType.PROJECT],
    [`l=list&p=cp.${CP},-labels`, EIssuesStoreType.PROJECT],
    [`l=list&f=state_id:in:${S1},${S2};!priority:in:urgent`, EIssuesStoreType.PROJECT],
    [`l=list&f=cp.${CP}:exact:yes`, EIssuesStoreType.ARCHIVED],
    [`l=list&f=${JSON_FILTERS}`, EIssuesStoreType.PROJECT],
    ["l=list&f=none", EIssuesStoreType.PROJECT_VIEW],
    ['l=table&q=state = "In Progress"', EIssuesStoreType.GLOBAL],
    ["l=list&q=", EIssuesStoreType.PROJECT_VIEW],
    ["l=list&peek=INOMO2-123", EIssuesStoreType.PROJECT],
    [
      `l=kanban&g=priority&sg=state&o=-created_at&x=empty,sub&p=-labels&f=priority:in:high&q=title ~ "x"&peek=WEB-9`,
      EIssuesStoreType.PROJECT,
    ],
  ])("%s on %s", (query, storeType) => {
    const result = canonical(query, storeType, storeType === EIssuesStoreType.PROJECT_VIEW ? view : undefined);
    expect(result.invalid).toEqual([]);
    expect(result.query).toBe(query);
  });

  it("survives URL encoding", () => {
    const entries = [
      ["l", "list"],
      ["f", JSON_FILTERS],
      ["q", 'name ~ "a & b" or name ~ "c=d+e"'],
    ];
    const encoded = new URLSearchParams(entries).toString();
    expect(canonical(encoded).query).toBe(entries.map(([key, value]) => `${key}=${value}`).join("&"));
  });
});

describe("canonical form", () => {
  it.each<[string, string, TWorkItemPageStoreType?]>([
    [
      "peek=WEB-1&q=x&f=priority:in:high&p=-labels&x=sub&o=-priority&g=priority&l=list",
      "l=list&g=priority&o=-priority&x=sub&p=-labels&f=priority:in:high&q=x&peek=WEB-1",
    ],
    ["a=1&l=list&b=2&g=priority&a=3", "l=list&g=priority&a=1&b=2&a=3"],
    ["l=spreadsheet", "l=table"],
    ["l=gantt_chart", "l=timeline"],
    ["l=list&g=state_detail.group", "l=list&g=state_group", EIssuesStoreType.PROFILE],
    ["l=list&x=sub,empty", "l=list&x=empty,sub"],
    ["l=list&x=sub,-sub", "l=list"],
    ["l=list&p=-labels,-estimate", "l=list&p=-estimate,-labels"],
    [`l=list&p=+cp.${CP.toUpperCase()}`, `l=list&p=cp.${CP}`],
    ["l=list&o=sort_order&g=none&x=-sub", "l=list"],
    ["l=list&q=%20%20x%20", "l=list&q=x"],
    ["l=list&q=", "l=list"],
    ["l=list&f=none", "l=list"],
    [`l=list&f=priority:in:high, low,`, "l=list&f=priority:in:high,low"],
    ["l=list&peek=web-01", "l=list&peek=WEB-1"],
    ["l=timeline&color=state&z=month", "l=timeline"],
    ["l=calendar&cal=month", "l=calendar"],
    ["l=kanban", "l=kanban&g=state"],
    ["l=kanban&g=priority&sg=priority", "l=kanban&g=priority"],
    ["l=kanban", "l=kanban&g=priority", EIssuesStoreType.PROFILE],
    ["l=table&o=sort_order", "l=table", EIssuesStoreType.GLOBAL],
  ])("%s -> %s", (query, expected, storeType = EIssuesStoreType.PROJECT) => {
    expect(canonical(query, storeType).query).toBe(expected);
  });

  it("only writes params that apply to the layout", () => {
    const state = {
      ...withFilters(projectBaseline, { sub_group_by: "priority", color_by: "key", hierarchy: true }),
      timelineZoom: "week" as const,
      calendarAnchor: "2026-01-01",
    };
    expect(encode(state)).toBe("l=list");
  });

  it("treats missing rich filters as none", () => {
    expect(encode({ ...projectBaseline, richFilters: null })).toBe("l=list");
    expect(encode({ ...projectBaseline, richFilters: undefined })).toBe("l=list");
  });
});

const calendar = (calendarLayout: TCalendarLayouts, calendarAnchor?: string): TWorkItemViewState => ({
  ...withFilters(projectBaseline, { layout: EIssueLayoutTypes.CALENDAR, calendar: { layout: calendarLayout } }),
  calendarAnchor,
});

describe("calendar anchor", () => {
  it.each<[string, TCalendarLayouts, string | undefined, TCalendarClock, string]>([
    ["no anchor", "month", undefined, CLOCK, "l=calendar"],
    ["today's month", "month", "2026-10-30", CLOCK, "l=calendar"],
    ["another month", "month", "2026-11-03", CLOCK, "l=calendar&d=2026-11"],
    ["today's week", "week", "2026-10-11", CLOCK, "l=calendar&cal=week"],
    ["the next week", "week", "2026-10-15", CLOCK, "l=calendar&cal=week&d=2026-10-12"],
    ["the previous week", "week", "2026-10-04", CLOCK, "l=calendar&cal=week&d=2026-09-28"],
    [
      "the next week from Sunday",
      "week",
      "2026-10-15",
      { ...CLOCK, weekStart: EStartOfTheWeek.SUNDAY },
      "l=calendar&cal=week&d=2026-10-11",
    ],
    [
      "a Sunday that starts this week",
      "week",
      "2026-10-04",
      { ...CLOCK, weekStart: EStartOfTheWeek.SUNDAY },
      "l=calendar&cal=week",
    ],
  ])("%s", (_, calendarLayout, anchor, clock, expected) => {
    expect(encode(calendar(calendarLayout, anchor), projectBaseline, project, clock)).toBe(expected);
  });

  it.each([
    ["l=calendar&cal=week&d=2026-10-15", "2026-10-15"],
    ["l=calendar&cal=week&d=2026-10", "2026-10-01"],
    ["l=calendar&d=2026-11", "2026-11-01"],
  ])("reads %s as a day in the shown period", (query, anchor) => {
    expect(fromSearch(new URLSearchParams(query), projectBaseline, project).state.calendarAnchor).toBe(anchor);
  });

  it("keeps calendar settings that are not in the URL", () => {
    const baseline = withFilters(projectBaseline, { calendar: { show_weekends: true, layout: "month" } });
    const { state } = fromSearch(new URLSearchParams("l=calendar&cal=week&d=2026-10-15"), baseline, project);
    expect(state.displayFilters.calendar).toEqual({ show_weekends: true, layout: "week" });
  });
});

describe("baseline diffs", () => {
  const view: TSavedViewConfig = {
    display_filters: { layout: EIssueLayoutTypes.KANBAN, group_by: "priority", sub_group_by: "labels" },
    display_properties: { labels: false, [`custom_property_${CP}`]: true },
    rich_filters: { and: [{ state_id__in: S1 }, { priority__in: "high" }] },
  };
  const page = getWorkItemPage(EIssuesStoreType.PROJECT_VIEW);
  const baseline = getPageBaseline(page, view);

  it("builds the baseline from the view config", () => {
    expect(baseline.displayFilters).toMatchObject({ layout: "kanban", group_by: "priority", sub_group_by: "labels" });
    expect(baseline.displayProperties).toMatchObject({
      labels: false,
      estimate: true,
      [`custom_property_${CP}`]: true,
    });
    expect(baseline.richFilters).toEqual(view.rich_filters);
  });

  it.each<[string, TWorkItemViewState, string]>([
    ["the view itself", baseline, "l=kanban"],
    [
      "reordered view filters",
      { ...baseline, richFilters: { and: [{ priority__in: "high" }, { state_id__in: S1 }] } },
      "l=kanban",
    ],
    ["no sub-group", withFilters(baseline, { sub_group_by: null }), "l=kanban&sg=none"],
    [
      "no grouping in list",
      withFilters(baseline, { layout: EIssueLayoutTypes.LIST, group_by: null, sub_group_by: null }),
      "l=list&g=none",
    ],
    ["cleared filters", { ...baseline, richFilters: {} }, "l=kanban&f=none"],
    ["changed filters", { ...baseline, richFilters: { state_id__in: S1 } }, `l=kanban&f=state_id:in:${S1}`],
    [
      "shown labels, hidden custom property",
      {
        ...baseline,
        displayProperties: { ...baseline.displayProperties, labels: true, [`custom_property_${CP}`]: false },
      },
      `l=kanban&p=-cp.${CP},labels`,
    ],
  ])("%s", (_, state, expected) => {
    expect(encode(state, baseline, page)).toBe(expected);
  });

  it("reads missing params as the view", () => {
    const { state } = fromSearch(new URLSearchParams("l=kanban&g=state"), baseline, page);
    expect(state.displayFilters).toMatchObject({ group_by: "state", sub_group_by: "labels" });
    expect(state.richFilters).toEqual(view.rich_filters);
  });

  it.each<[TWorkItemPageStoreType, IIssueDisplayFilterOptions]>([
    [
      EIssuesStoreType.PROJECT,
      { layout: EIssueLayoutTypes.LIST, order_by: "sort_order", group_by: null, sub_issue: false },
    ],
    [EIssuesStoreType.ARCHIVED, { layout: EIssueLayoutTypes.LIST, sub_issue: true }],
    [EIssuesStoreType.PROFILE, { layout: EIssueLayoutTypes.LIST, group_by: null }],
    [EIssuesStoreType.GLOBAL, { layout: EIssueLayoutTypes.SPREADSHEET, order_by: "-created_at" }],
  ])("system baseline of %s", (storeType, expected) => {
    expect(getPageBaseline(getWorkItemPage(storeType)).displayFilters).toMatchObject(expected);
  });

  it("replaces a manual order in workspace views", () => {
    const globalPage = getWorkItemPage(EIssuesStoreType.GLOBAL);
    const viewBaseline = getPageBaseline(globalPage, {
      display_filters: { layout: EIssueLayoutTypes.SPREADSHEET, order_by: "sort_order" },
    });
    expect(viewBaseline.displayFilters.order_by).toBe("-created_at");
  });

  it.each<[string, TWorkItemPageStoreType, TSavedViewConfig, string]>([
    [
      "a workspace view without a layout",
      EIssuesStoreType.GLOBAL,
      { display_filters: { order_by: "-priority" } },
      "spreadsheet",
    ],
    [
      "an archived kanban",
      EIssuesStoreType.ARCHIVED,
      { display_filters: { layout: EIssueLayoutTypes.KANBAN } },
      "list",
    ],
    [
      "a profile calendar",
      EIssuesStoreType.PROFILE,
      { display_filters: { layout: EIssueLayoutTypes.CALENDAR } },
      "list",
    ],
  ])("clamps %s to a layout the page renders", (_, storeType, config, layout) => {
    const clampedPage = getWorkItemPage(storeType);
    const viewBaseline = getPageBaseline(clampedPage, config);
    expect(viewBaseline.displayFilters.layout).toBe(layout);
    const query = plain(toSearch(viewBaseline, viewBaseline, clampedPage, { clock: CLOCK }));
    const result = fromSearch(new URLSearchParams(query), viewBaseline, clampedPage);
    expect(result.invalid).toEqual([]);
    expect(plain(toSearch(result.state, viewBaseline, clampedPage, { clock: CLOCK }))).toBe(query);
  });
});

describe("invalid values", () => {
  it.each<[string, string[], string, TWorkItemPageStoreType?]>([
    ["l=grid", ["l"], "l=list"],
    ["l=calendar", ["l"], "l=list", EIssuesStoreType.ARCHIVED],
    ["l=list", ["l"], "l=table", EIssuesStoreType.GLOBAL],
    ["l=list&g=bogus", ["g"], "l=list"],
    ["l=list&g=state_group", ["g"], "l=list"],
    ["l=kanban&g=none", ["g"], "l=kanban&g=state"],
    ["l=list&sg=priority", ["sg"], "l=list"],
    ["l=list&o=random", ["o"], "l=list"],
    ["l=timeline&o=-priority", ["o"], "l=timeline"],
    ["l=list&x=sub,bogus", ["x"], "l=list&x=sub"],
    ["l=list&x=tree", ["x"], "l=list"],
    ["l=list&x=,", ["x"], "l=list"],
    ["l=list&x=", ["x"], "l=list"],
    ["l=calendar&cal=year", ["cal"], "l=calendar"],
    ["l=calendar&d=2026-02-30", ["d"], "l=calendar"],
    ["l=list&d=2026-11", ["d"], "l=list"],
    ["l=timeline&z=decade", ["z"], "l=timeline"],
    ["l=list&color=key", ["color"], "l=list"],
    ["l=list&p=-bogus,-labels", ["p"], "l=list&p=-labels"],
    ["l=calendar&p=-labels,-key", ["p"], "l=calendar&p=-key"],
    [`l=list&p=cp.${CP}`, ["p"], "l=list", EIssuesStoreType.PROFILE],
    ["l=list&f=nope", ["f"], "l=list"],
    ["l=list&f=priority:gt:high", ["f"], "l=list"],
    ["l=list&f=j.e25vdCBqc29u", ["f"], "l=list"],
    ["l=list&q=x", ["q"], "l=list", EIssuesStoreType.ARCHIVED],
    ["l=list&peek=nope", ["peek"], "l=list"],
    ["l=grid&g=bogus&peek=x", ["l", "g", "peek"], "l=list"],
    ["l=list&l=kanban", ["l"], "l=list"],
    ["l=list&f=priority:in:high&f=priority:in:low", ["f"], "l=list&f=priority:in:high"],
    ["l=list&peek=WEB-1&peek=WEB-2", ["peek"], "l=list&peek=WEB-1"],
  ])("%s", (query, invalid, expected, storeType = EIssuesStoreType.PROJECT) => {
    const result = canonical(query, storeType);
    expect(result.invalid.map(({ param }) => param)).toEqual(invalid);
    expect(result.query).toBe(expected);
  });

  it("keeps the raw value of invalid and duplicate params", () => {
    expect(canonical("l=grid").invalid).toEqual([{ param: "l", value: "grid" }]);
    expect(canonical("l=list&l=kanban").invalid).toEqual([{ param: "l", value: "kanban" }]);
  });
});

describe("layouts per page", () => {
  const layouts = ["list", "kanban", "calendar", "table", "timeline"];

  it.each<[TWorkItemPageStoreType, string[]]>([
    [EIssuesStoreType.PROJECT, layouts],
    [EIssuesStoreType.CYCLE, layouts],
    [EIssuesStoreType.MODULE, layouts],
    [EIssuesStoreType.PROJECT_VIEW, layouts],
    [EIssuesStoreType.ARCHIVED, ["list"]],
    [EIssuesStoreType.PROFILE, ["list", "kanban"]],
    [EIssuesStoreType.GLOBAL, ["table"]],
  ])("%s accepts %j", (storeType, accepted) => {
    const valid = layouts.filter((layout) => canonical(`l=${layout}`, storeType).invalid.length === 0);
    expect(valid).toEqual(accepted);
  });

  it.each<[TWorkItemPageStoreType, EIssueLayoutTypes, string]>([
    [EIssuesStoreType.PROJECT, EIssueLayoutTypes.LIST, "l g o x p f q peek"],
    [EIssuesStoreType.PROJECT, EIssueLayoutTypes.KANBAN, "l g sg o x p f q peek"],
    [EIssuesStoreType.PROJECT, EIssueLayoutTypes.CALENDAR, "l x cal d p f q peek"],
    [EIssuesStoreType.PROJECT, EIssueLayoutTypes.SPREADSHEET, "l o x p f q peek"],
    [EIssuesStoreType.PROJECT, EIssueLayoutTypes.GANTT, "l x color z p f q peek"],
    [EIssuesStoreType.ARCHIVED, EIssueLayoutTypes.LIST, "l g o x p f peek"],
    [EIssuesStoreType.ARCHIVED, EIssueLayoutTypes.KANBAN, "l f peek"],
    [EIssuesStoreType.PROFILE, EIssueLayoutTypes.KANBAN, "l g o x p f peek"],
    [EIssuesStoreType.GLOBAL, EIssueLayoutTypes.SPREADSHEET, "l o x p f q peek"],
    [EIssuesStoreType.GLOBAL, EIssueLayoutTypes.LIST, "l f q peek"],
  ])("%s %s takes %s", (storeType, layout, params) => {
    const page = getWorkItemPage(storeType);
    const applicable = VIEW_PARAMS.filter((spec) => spec.paths(page, layout).length > 0).map(({ param }) => param);
    expect(applicable.join(" ")).toBe(params);
  });

  it.each<[TWorkItemPageStoreType, EIssueLayoutTypes, string[]]>([
    [EIssuesStoreType.PROJECT, EIssueLayoutTypes.LIST, ["sub_issue", "show_empty_groups"]],
    [EIssuesStoreType.PROJECT, EIssueLayoutTypes.CALENDAR, ["sub_issue"]],
    [EIssuesStoreType.PROJECT, EIssueLayoutTypes.SPREADSHEET, ["sub_issue", "hierarchy"]],
    [EIssuesStoreType.ARCHIVED, EIssueLayoutTypes.LIST, ["show_empty_groups"]],
    [EIssuesStoreType.GLOBAL, EIssueLayoutTypes.SPREADSHEET, ["sub_issue", "hierarchy"]],
  ])("x on %s %s owns %j", (storeType, layout, flags) => {
    const paths = getApplicablePaths(getWorkItemPage(storeType), layout);
    const owned = ["sub_issue", "show_empty_groups", "hierarchy"].filter((flag) =>
      paths.some((path) => path === `displayFilters.${flag}`)
    );
    expect(owned).toEqual(flags);
  });

  it.each<[TWorkItemPageStoreType, EIssueLayoutTypes, string[]]>([
    [EIssuesStoreType.PROJECT, EIssueLayoutTypes.CALENDAR, ["key", "issue_type", "custom_property_*"]],
    [EIssuesStoreType.PROJECT, EIssueLayoutTypes.GANTT, ["key", "issue_type", "custom_property_*"]],
    [EIssuesStoreType.PROFILE, EIssueLayoutTypes.LIST, [...ISSUE_DISPLAY_PROPERTIES_KEYS]],
  ])("p on %s %s owns %j", (storeType, layout, properties) => {
    const paths = getApplicablePaths(getWorkItemPage(storeType), layout).filter((path) =>
      path.startsWith("displayProperties.")
    );
    expect(paths).toEqual(properties.map((property) => `displayProperties.${property}`));
  });

  it("leaves hidden properties alone when reloading a calendar", () => {
    const baseline = projectBaseline;
    const state = { ...withFilters(baseline, { layout: EIssueLayoutTypes.CALENDAR }) };
    state.displayProperties = { ...state.displayProperties, labels: false };
    const query = encode(state);
    expect(query).toBe("l=calendar");
    const paths = getApplicablePaths(project, EIssueLayoutTypes.CALENDAR);
    expect(paths).not.toContain("displayProperties.labels");
  });
});

describe("store normalizations", () => {
  it.each<
    [string, IIssueDisplayFilterOptions, Exclude<TIssueGroupByOptions, null> | undefined, IIssueDisplayFilterOptions]
  >([
    [
      "no group clears the sub-group",
      { layout: EIssueLayoutTypes.LIST, group_by: null, sub_group_by: "labels" },
      undefined,
      { sub_group_by: null },
    ],
    [
      "kanban needs a group",
      { layout: EIssueLayoutTypes.KANBAN, group_by: null },
      undefined,
      { group_by: "state", sub_group_by: null },
    ],
    [
      "kanban defaults per page",
      { layout: EIssueLayoutTypes.KANBAN, group_by: null },
      "priority",
      { group_by: "priority", sub_group_by: null },
    ],
    [
      "kanban sub-group differs from the group",
      { layout: EIssueLayoutTypes.KANBAN, group_by: "labels", sub_group_by: "labels" },
      undefined,
      { sub_group_by: null },
    ],
    ["valid kanban", { layout: EIssueLayoutTypes.KANBAN, group_by: "labels", sub_group_by: "state" }, undefined, {}],
    [
      "list keeps equal groups",
      { layout: EIssueLayoutTypes.LIST, group_by: "labels", sub_group_by: "labels" },
      undefined,
      {},
    ],
  ])("%s", (_, displayFilters, kanbanGroupBy, corrections) => {
    expect(getDisplayFilterCorrections(displayFilters, kanbanGroupBy)).toEqual(corrections);
  });
});

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("generated states", () => {
  const random = mulberry32(42);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const coin = () => random() < 0.5;

  const storeTypes: TWorkItemPageStoreType[] = [
    EIssuesStoreType.PROJECT,
    EIssuesStoreType.CYCLE,
    EIssuesStoreType.MODULE,
    EIssuesStoreType.PROJECT_VIEW,
    EIssuesStoreType.ARCHIVED,
    EIssuesStoreType.PROFILE,
    EIssuesStoreType.GLOBAL,
  ];
  const groups: TIssueGroupByOptions[] = ["state", "priority", "labels", "assignees", "state_detail.group", null];
  const orders: TIssueOrderByOptions[] = ["sort_order", "-created_at", "-priority", "-state__name", "target_date"];
  const filters: TWorkItemFilterExpression[] = [
    {},
    { state_id__in: `${S1},${S2}` },
    { not: { priority__in: "urgent" } },
    { and: [{ label_id__in: S1 }, { not: { name__icontains: "a;b" } }] },
    { and: [{ and: [{ start_date__range: "2026-01-01,2026-02-01" }] }, { priority__exact: "high" }] },
    { [`customproperty_${CP}__gt`]: 3 },
  ];
  const views: (TSavedViewConfig | undefined)[] = [
    undefined,
    {
      display_filters: { layout: EIssueLayoutTypes.KANBAN, group_by: "priority" },
      rich_filters: { priority__in: "high" },
    },
    { display_filters: { show_empty_groups: true, pql: "x" }, display_properties: { labels: false } },
  ];

  const generate = (page: TWorkItemPage): TWorkItemViewState => {
    const layout = pick(page.layouts);
    const options = getLayoutOptions(page, layout);
    const groupOptions = options?.display_filters.group_by ?? groups;
    const subGroupOptions = options?.display_filters.sub_group_by ?? groups;
    const displayProperties = getComputedDisplayProperties();
    for (const key of ISSUE_DISPLAY_PROPERTIES_KEYS) if (coin()) displayProperties[key] = false;
    if (coin()) displayProperties[`custom_property_${CP}`] = coin();
    return normalizeViewState(
      {
        displayFilters: {
          layout,
          group_by: pick(groupOptions),
          sub_group_by: pick(subGroupOptions),
          order_by: pick(orders),
          sub_issue: coin(),
          show_empty_groups: coin(),
          hierarchy: coin(),
          calendar: { show_weekends: coin(), layout: pick(["month", "week"] as const) },
          color_by: pick([undefined, "state", "key"] as const),
          pql: pick(["", " x ", 'name ~ "a & b"']),
        },
        displayProperties,
        richFilters: pick(filters),
        calendarAnchor: pick([undefined, "2026-10-07", "2026-03-15", "2027-01-01"]),
        timelineZoom: pick([undefined, "week", "month", "quarter"] as const),
        peek: coin() ? undefined : { projectIdentifier: "WEB", sequenceId: Math.ceil(random() * 1000) },
      },
      page
    );
  };

  it("round-trips 500 random states", () => {
    for (let run = 0; run < 500; run++) {
      const page = getWorkItemPage(pick(storeTypes));
      const baseline = getPageBaseline(page, pick(views));
      const state = generate(page);
      const clock = { today: CLOCK.today, weekStart: pick([EStartOfTheWeek.SUNDAY, EStartOfTheWeek.MONDAY]) };
      const query = toSearch(state, baseline, page, { clock });
      const result = fromSearch(query, baseline, page);
      const context = `${page.storeType} ${plain(query)}`;
      expect(result.invalid, context).toEqual([]);
      expect(plain(toSearch(result.state, baseline, page, { clock })), context).toBe(plain(query));
      expect(result.state.displayFilters.layout, context).toBe(state.displayFilters.layout);
      expect(result.state.peek, context).toEqual(state.peek);
    }
  });
});
