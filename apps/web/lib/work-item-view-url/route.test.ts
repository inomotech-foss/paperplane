// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { EIssueLayoutTypes, EIssuesStoreType, EStartOfTheWeek } from "@plane/types";
import { getPageBaseline, getWorkItemPage } from "./pages";
import { buildViewSearch, isViewUrlWrite, shouldRevalidateView, VIEW_URL_WRITE } from "./route";

const page = getWorkItemPage(EIssuesStoreType.PROJECT);
const baseline = getPageBaseline(page);
const clock = { today: "2026-10-07", weekStart: EStartOfTheWeek.MONDAY };

const revalidate = (current: string, next: string, nextParams = { projectId: "p1" }) =>
  shouldRevalidateView({
    currentUrl: new URL(current, "http://x"),
    nextUrl: new URL(next, "http://x"),
    currentParams: { projectId: "p1" },
    nextParams,
    defaultShouldRevalidate: true,
  });

describe("shouldRevalidateView", () => {
  it("reruns only for owned params or another entity", () => {
    expect(revalidate("/p1/issues?l=list", "/p1/issues?l=list&other=1")).toBe(false);
    expect(revalidate("/p1/issues?l=list", "/p1/issues?l=kanban")).toBe(true);
    expect(revalidate("/p1/issues?l=list", "/p2/issues?l=list", { projectId: "p2" })).toBe(true);
  });
});

describe("buildViewSearch", () => {
  it("writes readable params and keeps the peek and foreign params", () => {
    const state = {
      ...baseline,
      displayFilters: { ...baseline.displayFilters, layout: EIssueLayoutTypes.KANBAN },
      richFilters: { priority__in: "urgent,high" },
    };
    const search = buildViewSearch(state, page, baseline, clock, new URLSearchParams("peek=DEMO-1&l=list&other=x"));
    expect(search).toBe("l=kanban&f=priority:in:urgent,high&peek=DEMO-1&other=x");
  });

  it("drops an invalid peek", () => {
    expect(buildViewSearch(baseline, page, baseline, clock, new URLSearchParams("peek=nope"))).toBe("l=list");
  });
});

describe("isViewUrlWrite", () => {
  it("recognizes the marker only", () => {
    expect(isViewUrlWrite(VIEW_URL_WRITE)).toBe(true);
    expect(isViewUrlWrite({ other: true })).toBe(false);
    expect(isViewUrlWrite(null)).toBe(false);
  });
});
