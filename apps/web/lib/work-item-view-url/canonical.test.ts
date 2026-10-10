// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type {
  IIssueFilters,
  TCalendarLayouts,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
  TWorkItemFilterExpression,
} from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType, EStartOfTheWeek } from "@plane/types";
import { getPageBaseline, getWorkItemPage } from "./pages";
import { resolveViewRoute } from "./resolve";
import type { TViewDeps } from "./resolve";

const page = getWorkItemPage(EIssuesStoreType.PROJECT);
const baseline = getPageBaseline(page);
const CLOCK = { today: "2026-10-09", weekStart: EStartOfTheWeek.MONDAY };

// a fixed linear congruential generator, so a failure always reproduces
let seed = 7;
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)];

const LAYOUTS: (EIssueLayoutTypes | undefined)[] = [...Object.values(EIssueLayoutTypes), undefined];
const GROUPS: (TIssueGroupByOptions | undefined)[] = [
  "state",
  "priority",
  "labels",
  "assignees",
  "state_detail.group",
  "cycle",
  "module",
  "created_by",
  "project",
  "team_project",
  "target_date",
  null,
  undefined,
];
const ORDERS: (TIssueOrderByOptions | undefined)[] = ["sort_order", "-created_at", "priority", "-priority", undefined];
const CALENDARS: (TCalendarLayouts | undefined)[] = ["week", "month", undefined];
const QUERIES = ["", "a = 1", "it's", "nope", "  x  ", undefined];
const RICH: TWorkItemFilterExpression[] = [
  {},
  { priority__in: "urgent" },
  { assignee_id__in: "None" },
  { and: [{ priority__in: "high" }] },
  { and: [{ priority__in: "high" }, { state_group__in: "backlog" }] },
];
const PARAMS: [string, string[]][] = [
  ["l", ["list", "kanban", "calendar", "table", "timeline", "spreadsheet", "x"]],
  ["g", ["state", "none", "priority", "state_group", "x"]],
  ["sg", ["state", "none", "priority", "x"]],
  ["o", ["-priority", "sort_order", "x"]],
  ["x", ["sub", "-sub", "empty", "tree", "-empty,tree", "x"]],
  ["cal", ["week", "month", "x"]],
  ["color", ["state", "label", "x"]],
  ["p", ["-labels", "labels", "-x"]],
  ["f", ["none", "priority:in:urgent", "j.bnVsbA", "x"]],
  ["q", ["", "a = 1", "nope", "it's"]],
  ["peek", ["A-1", "x"]],
];

const randomSaved = (): IIssueFilters => ({
  richFilters: pick(RICH),
  displayFilters: {
    ...(random() < 0.5 ? baseline.displayFilters : {}),
    layout: pick(LAYOUTS),
    group_by: pick(GROUPS),
    sub_group_by: pick(GROUPS),
    order_by: pick(ORDERS),
    pql: pick(QUERIES),
    sub_issue: random() < 0.5,
    show_empty_groups: random() < 0.5,
    calendar: random() < 0.5 ? { layout: pick(CALENDARS), show_weekends: true } : undefined,
  },
  displayProperties: random() < 0.5 ? baseline.displayProperties : { labels: false },
  kanbanFilters: undefined,
});

const randomSearch = () => {
  const params = new URLSearchParams();
  for (const [key, values] of PARAMS) if (random() < 0.3) params.append(key, pick(values));
  const search = params.toString();
  return search ? `?${search}` : "";
};

const resolve = (search: string, deps: TViewDeps) =>
  resolveViewRoute(new URL(`http://localhost/p1/issues${search}`), page, deps);

describe("canonical URLs", () => {
  it("are reached in one redirect and then stay, for any saved preferences and URL", async () => {
    const cases = Array.from({ length: 5000 }, () => ({ saved: randomSaved(), search: randomSearch() }));
    const results = await Promise.all(
      cases.map(async ({ saved, search }) => {
        const deps: TViewDeps = {
          loadSaved: async () => saved,
          validatePql: async (pql) => ({ valid: pql !== "nope" }),
          clock: () => CLOCK,
        };
        const first = await resolve(search, deps);
        if (first.canonical === undefined) return undefined;
        const second = await resolve(first.canonical, deps);
        if (second.canonical !== undefined) {
          return `${search} -> ${first.canonical} -> ${second.canonical} saved=${JSON.stringify(saved)}`;
        }
        // a saved invalid query is only checked once it is in the URL, where it becomes a draft
        if (!second.draft && JSON.stringify(first.state) !== JSON.stringify(second.state)) {
          return `${search} -> ${first.canonical} shows another state, saved=${JSON.stringify(saved)}`;
        }
        return undefined;
      })
    );
    expect(results.filter(Boolean).slice(0, 5)).toEqual([]);
  });
});
