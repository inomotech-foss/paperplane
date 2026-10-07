// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { IIssueDisplayFilterOptions, TWorkItemFilterExpression } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { formatRichFilters } from "./codecs";
import { getPageBaseline, getWorkItemPage } from "./pages";
import type { TWorkItemPageStoreType } from "./pages";
import { VIEW_PARAMS } from "./schema";
import { fromSearch, toSearch } from "./serialize";
import type { TSavedViewConfig, TWorkItemViewState } from "./types";

const CP = "0b5c6a3e-8f1d-4c2a-9e7b-1a2b3c4d5e6f";

const project = getWorkItemPage(EIssuesStoreType.PROJECT);
const projectBaseline = getPageBaseline(project);

const withFilters = (state: TWorkItemViewState, displayFilters: IIssueDisplayFilterOptions): TWorkItemViewState => ({
  ...state,
  displayFilters: { ...state.displayFilters, ...displayFilters },
});

/** Decoded query string, for readable expectations. */
const plain = (params: URLSearchParams) => [...params].map(([key, value]) => `${key}=${value}`).join("&");

const canonical = (
  query: string,
  storeType: TWorkItemPageStoreType = EIssuesStoreType.PROJECT,
  view?: TSavedViewConfig
) => {
  const page = getWorkItemPage(storeType);
  const baseline = getPageBaseline(page, view);
  const params = new URLSearchParams(query);
  const result = fromSearch(params, baseline, page);
  return { ...result, query: plain(toSearch(result.state, baseline, page, params)) };
};

const JSON_FILTERS = formatRichFilters({ and: [{ name__icontains: "fix: a; b, c" }, { not: { state_id__in: "a" } }] });

describe("explicit marker", () => {
  it("treats no params as plain navigation", () => {
    const result = fromSearch(new URLSearchParams(), projectBaseline, project);
    expect(result).toEqual({ explicit: false, state: projectBaseline, invalid: [] });
  });

  it("always writes l", () => {
    expect(plain(toSearch(projectBaseline, projectBaseline, project))).toBe("l=list");
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

describe("round trips", () => {
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
    ["l=calendar&d=2026-10", EIssuesStoreType.PROJECT],
    ["l=calendar&cal=week&d=2026-10-05", EIssuesStoreType.PROJECT],
    ["l=timeline&color=key", EIssuesStoreType.PROJECT],
    ["l=timeline&z=quarter", EIssuesStoreType.PROJECT],
    ["l=list&p=-estimate,-labels", EIssuesStoreType.PROJECT],
    [`l=list&p=cp.${CP},-labels`, EIssuesStoreType.PROJECT],
    ["l=list&f=state_id:in:a,b;!priority:in:urgent", EIssuesStoreType.PROJECT],
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
    const view: TSavedViewConfig = {
      display_filters: { group_by: "priority", show_empty_groups: true, pql: "priority = high" },
      rich_filters: { state_id__in: "a" },
    };
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

  it("writes month anchors without the day", () => {
    const state: TWorkItemViewState = {
      ...withFilters(projectBaseline, { layout: EIssueLayoutTypes.CALENDAR }),
      calendarAnchor: "2026-10-05",
    };
    expect(plain(toSearch(state, projectBaseline, project))).toBe("l=calendar&d=2026-10");
  });

  it("omits the anchor while it shows today", () => {
    const today = { ...projectBaseline, calendarAnchor: "2026-10-07" };
    const state = { ...withFilters(today, { layout: EIssueLayoutTypes.CALENDAR }), calendarAnchor: "2026-10-01" };
    expect(plain(toSearch(state, today, project))).toBe("l=calendar");
    expect(plain(toSearch(withFilters(state, { calendar: { layout: "week" } }), today, project))).toBe(
      "l=calendar&cal=week&d=2026-10-01"
    );
  });

  it("only writes params that apply to the layout", () => {
    const state = {
      ...withFilters(projectBaseline, { sub_group_by: "priority", color_by: "key", hierarchy: true }),
      timelineZoom: "week" as const,
      calendarAnchor: "2026-01-01",
    };
    expect(plain(toSearch(state, projectBaseline, project))).toBe("l=list");
  });
});

describe("baseline diffs", () => {
  const view: TSavedViewConfig = {
    display_filters: { layout: EIssueLayoutTypes.KANBAN, group_by: "priority", sub_group_by: "labels" },
    display_properties: { labels: false, [`custom_property_${CP}`]: true },
    rich_filters: { and: [{ state_id__in: "a" }, { priority__in: "high" }] },
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
      { ...baseline, richFilters: { and: [{ priority__in: "high" }, { state_id__in: "a" }] } },
      "l=kanban",
    ],
    ["no sub-group", withFilters(baseline, { sub_group_by: null }), "l=kanban&sg=none"],
    [
      "no grouping in list",
      withFilters(baseline, { layout: EIssueLayoutTypes.LIST, group_by: null, sub_group_by: null }),
      "l=list&g=none",
    ],
    ["cleared filters", { ...baseline, richFilters: {} }, "l=kanban&f=none"],
    ["changed filters", { ...baseline, richFilters: { state_id__in: "a" } }, "l=kanban&f=state_id:in:a"],
    [
      "shown labels, hidden custom property",
      {
        ...baseline,
        displayProperties: { ...baseline.displayProperties, labels: true, [`custom_property_${CP}`]: false },
      },
      `l=kanban&p=-cp.${CP},labels`,
    ],
  ])("%s", (_, state, expected) => {
    expect(plain(toSearch(state, baseline, page))).toBe(expected);
  });

  it("reads missing params as the view", () => {
    const { state } = fromSearch(new URLSearchParams("l=kanban&g=state"), baseline, page);
    expect(state.displayFilters).toMatchObject({ group_by: "state", sub_group_by: "labels" });
    expect(state.richFilters).toEqual(view.rich_filters);
  });

  it.each<[TWorkItemPageStoreType, IIssueDisplayFilterOptions]>([
    [EIssuesStoreType.PROJECT, { layout: "list", order_by: "sort_order", group_by: null, sub_issue: false }],
    [EIssuesStoreType.ARCHIVED, { layout: "list", sub_issue: true }],
    [EIssuesStoreType.PROFILE, { layout: "list", group_by: null }],
    [EIssuesStoreType.GLOBAL, { layout: "spreadsheet", order_by: "-created_at" }],
  ])("system baseline of %s", (storeType, expected) => {
    expect(getPageBaseline(getWorkItemPage(storeType)).displayFilters).toMatchObject(expected);
  });

  it("replaces a manual order in workspace views", () => {
    const globalPage = getWorkItemPage(EIssuesStoreType.GLOBAL);
    const viewBaseline = getPageBaseline(globalPage, {
      display_filters: { layout: "spreadsheet", order_by: "sort_order" },
    });
    expect(viewBaseline.displayFilters.order_by).toBe("-created_at");
  });
});

describe("invalid values", () => {
  it.each<[string, string[], string, TWorkItemPageStoreType?]>([
    ["l=grid", ["l"], "l=list"],
    ["l=calendar", ["l"], "l=list", EIssuesStoreType.ARCHIVED],
    ["l=list&g=bogus", ["g"], "l=list"],
    ["l=list&g=state_group", ["g"], "l=list"],
    ["l=kanban&g=none", ["g"], "l=kanban&g=state"],
    ["l=list&sg=priority", ["sg"], "l=list"],
    ["l=list&o=random", ["o"], "l=list"],
    ["l=timeline&o=-priority", ["o"], "l=timeline"],
    ["l=list&x=sub,bogus", ["x"], "l=list&x=sub"],
    ["l=list&x=tree", ["x"], "l=list"],
    ["l=calendar&cal=year", ["cal"], "l=calendar"],
    ["l=calendar&d=2026-02-30", ["d"], "l=calendar"],
    ["l=list&d=2026-10", ["d"], "l=list"],
    ["l=timeline&z=decade", ["z"], "l=timeline"],
    ["l=list&color=key", ["color"], "l=list"],
    ["l=list&p=-bogus,-labels", ["p"], "l=list&p=-labels"],
    [`l=list&p=cp.${CP}`, ["p"], "l=list", EIssuesStoreType.PROFILE],
    ["l=list&f=nope", ["f"], "l=list"],
    ["l=list&f=j.e25vdCBqc29u", ["f"], "l=list"],
    ["l=list&q=x", ["q"], "l=list", EIssuesStoreType.ARCHIVED],
    ["l=list&peek=nope", ["peek"], "l=list"],
    ["l=grid&g=bogus&peek=x", ["l", "g", "peek"], "l=list"],
  ])("%s", (query, invalid, expected, storeType = EIssuesStoreType.PROJECT) => {
    const result = canonical(query, storeType);
    expect(result.invalid.map(({ param }) => param)).toEqual(invalid);
    expect(result.query).toBe(expected);
  });

  it("keeps the raw value of invalid params", () => {
    expect(canonical("l=grid").invalid).toEqual([{ param: "l", value: "grid" }]);
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
    const applicable = VIEW_PARAMS.filter((spec) => spec.appliesTo(page, layout)).map(({ param }) => param);
    expect(applicable.join(" ")).toBe(params);
  });
});

describe("state", () => {
  it("decodes every param into the filter state", () => {
    const filters: TWorkItemFilterExpression = { not: { state_id__in: "a" } };
    const query = `l=kanban&g=priority&sg=labels&o=-priority&x=empty&p=-labels,cp.${CP}&f=!state_id:in:a&q=x&peek=WEB-2`;
    const { state } = fromSearch(new URLSearchParams(query), projectBaseline, project);
    expect(state).toEqual({
      ...projectBaseline,
      displayFilters: {
        ...projectBaseline.displayFilters,
        layout: "kanban",
        group_by: "priority",
        sub_group_by: "labels",
        order_by: "-priority",
        show_empty_groups: true,
        pql: "x",
      },
      displayProperties: { ...projectBaseline.displayProperties, labels: false, [`custom_property_${CP}`]: true },
      richFilters: filters,
      peek: { projectIdentifier: "WEB", sequenceId: 2 },
    });
  });

  it("keeps calendar settings that are not in the URL", () => {
    const baseline = withFilters(projectBaseline, { calendar: { show_weekends: true, layout: "month" } });
    const { state } = fromSearch(new URLSearchParams("l=calendar&cal=week&d=2026-10-05"), baseline, project);
    expect(state.displayFilters.calendar).toEqual({ show_weekends: true, layout: "week" });
    expect(state.calendarAnchor).toBe("2026-10-05");
  });

  it("decodes the timeline zoom", () => {
    expect(fromSearch(new URLSearchParams("l=timeline&z=week"), projectBaseline, project).state.timelineZoom).toBe(
      "week"
    );
  });
});
