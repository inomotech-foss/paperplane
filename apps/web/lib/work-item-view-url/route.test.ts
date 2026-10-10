// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { EIssueLayoutTypes, EIssuesStoreType, EStartOfTheWeek } from "@plane/types";
import { getPageBaseline, getWorkItemPage } from "./pages";
import { buildViewSearch } from "./resolve";
import { shouldRevalidateView } from "./route";
import type { TWorkItemViewState } from "./types";

const page = getWorkItemPage(EIssuesStoreType.PROJECT);
const baseline = getPageBaseline(page);
const clock = { today: "2026-10-07", weekStart: EStartOfTheWeek.MONDAY };
const CUSTOM = "custom_property_6f1c2a52-6d0c-4b8e-9f43-1d1f0e7f8b10";

const revalidate = (current: string, next: string, nextParams = { projectId: "p1" }) =>
  shouldRevalidateView({
    currentUrl: new URL(current, "http://x"),
    nextUrl: new URL(next, "http://x"),
    currentParams: { projectId: "p1" },
    nextParams,
    defaultShouldRevalidate: true,
  });

describe("shouldRevalidateView", () => {
  it("reruns only for applied params or another entity", () => {
    expect(revalidate("/p1/issues?l=list", "/p1/issues?l=list&other=1")).toBe(false);
    expect(revalidate("/p1/issues?l=list", "/p1/issues?l=kanban")).toBe(true);
    expect(revalidate("/p1/issues?l=list", "/p2/issues?l=list", { projectId: "p2" })).toBe(true);
  });

  it("ignores the params the loader does not apply yet", () => {
    expect(revalidate("/p1/issues?l=calendar", "/p1/issues?l=calendar&peek=DEMO-1")).toBe(false);
    expect(revalidate("/p1/issues?l=calendar", "/p1/issues?l=calendar&d=2026-11")).toBe(false);
    expect(revalidate("/p1/issues?l=gantt", "/p1/issues?l=gantt&z=week")).toBe(false);
  });

  it("reruns on a navigation to the same URL", () => {
    expect(revalidate("/p1/issues?l=list&other=1", "/p1/issues?l=list&other=1")).toBe(true);
  });
});

const withFilters = (displayFilters: TWorkItemViewState["displayFilters"], rest: Partial<TWorkItemViewState> = {}) => ({
  ...baseline,
  ...rest,
  displayFilters: { ...baseline.displayFilters, ...displayFilters },
});

const STATES: TWorkItemViewState[] = [
  baseline,
  withFilters({ pql: "priority = 'high' AND title ~ \"a b\"" }),
  withFilters({ pql: "title ~ 'it''s' OR name = \"50% & #1?\"" }),
  withFilters({ layout: EIssueLayoutTypes.KANBAN, group_by: "priority", sub_group_by: "labels" }),
  withFilters({ layout: EIssueLayoutTypes.CALENDAR, calendar: { layout: "week" } }),
  withFilters({ layout: EIssueLayoutTypes.SPREADSHEET, order_by: "-priority", sub_issue: false }),
  withFilters({ layout: EIssueLayoutTypes.GANTT, color_by: "key" }),
  withFilters({}, { displayProperties: { ...baseline.displayProperties, labels: false, [CUSTOM]: true } }),
  withFilters({}, { richFilters: { priority__in: "urgent,high" } }),
  withFilters({}, { richFilters: { and: [{ name__icontains: "a;b:c,d'e" }, { not: { priority__in: "none" } }] } }),
];

describe("buildViewSearch", () => {
  it("writes readable params and keeps the peek and foreign params", () => {
    const state = withFilters({ layout: EIssueLayoutTypes.KANBAN }, { richFilters: { priority__in: "urgent,high" } });
    const search = buildViewSearch(state, page, baseline, clock, new URLSearchParams("peek=DEMO-1&l=list&other=x"));
    expect(search).toBe("l=kanban&f=priority:in:urgent,high&peek=DEMO-1&other=x");
  });

  it("drops an invalid peek", () => {
    expect(buildViewSearch(baseline, page, baseline, clock, new URLSearchParams("peek=nope"))).toBe("l=list");
  });

  it.each(STATES.map((state, index): [number, TWorkItemViewState] => [index, state]))(
    "writes state %i in the form the browser keeps",
    (_, state) => {
      const search = `?${buildViewSearch(state, page, baseline, clock, new URLSearchParams("other=it's"))}`;
      expect(new URL(search, "http://localhost").search).toBe(search);
    }
  );
});
