// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { afterEach, describe, expect, it } from "vitest";
import { EIssueFilterType } from "@plane/constants";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { IssueFilterHelperStore } from "./issue-filter-helper.store";
import type { ILocalStoreIssueFilters } from "./local-issue-filters";
import { parseLocalIssueFilters } from "./local-issue-filters";

const KEY = "issue_local_filters";

const entry: ILocalStoreIssueFilters = {
  key: EIssuesStoreType.ARCHIVED,
  workspaceSlug: "ws",
  viewId: "p1",
  userId: undefined,
  filters: {
    rich_filters: { and: [{ state_id__in: "s1" }, { not: { priority__exact: "urgent" } }] },
    display_filters: {
      layout: EIssueLayoutTypes.KANBAN,
      group_by: "state",
      sub_group_by: null,
      order_by: "-created_at",
      calendar: { show_weekends: true, layout: "week" },
      pql: "",
    },
    display_properties: { assignee: false, custom_property_abc: true },
    kanban_filters: { group_by: ["g1"], sub_group_by: [] },
  },
};

afterEach(() => {
  localStorage.clear();
});

describe("parseLocalIssueFilters", () => {
  it("round trips valid entries", () => {
    expect(parseLocalIssueFilters(JSON.stringify([entry]))).toEqual([entry]);
  });

  it("returns no entries for missing or malformed JSON", () => {
    expect(parseLocalIssueFilters(undefined)).toEqual([]);
    expect(parseLocalIssueFilters("{not json")).toEqual([]);
  });

  it("returns no entries when the root is not an array", () => {
    expect(parseLocalIssueFilters(JSON.stringify({ 0: entry }))).toEqual([]);
    expect(parseLocalIssueFilters("42")).toEqual([]);
    expect(parseLocalIssueFilters("null")).toEqual([]);
  });

  it("drops entries with missing or invalid keys", () => {
    const raw = JSON.stringify([
      null,
      "entry",
      { key: entry.key, workspaceSlug: "ws", viewId: "p1" },
      { ...entry, key: "UNKNOWN" },
      { ...entry, workspaceSlug: 1 },
      { ...entry, viewId: 2 },
      entry,
    ]);
    expect(parseLocalIssueFilters(raw)).toEqual([entry]);
  });

  it("drops invalid filter values but keeps the entry", () => {
    const raw = JSON.stringify([
      {
        ...entry,
        filters: {
          richFilters: { state_id__in: "s1" },
          rich_filters: { unknown__in: "x" },
          display_filters: { layout: "board", group_by: "state", order_by: 5, legacy: true },
          display_properties: { assignee: "yes", labels: true, other: true },
          kanban_filters: { group_by: "g1", sub_group_by: ["s1", 3] },
        },
      },
    ]);
    expect(parseLocalIssueFilters(raw)).toEqual([
      {
        ...entry,
        filters: {
          display_filters: { group_by: "state" },
          display_properties: { labels: true },
          kanban_filters: { group_by: [], sub_group_by: ["s1"] },
        },
      },
    ]);
  });
});

describe("handleIssuesLocalFilters", () => {
  const { get, set } = new IssueFilterHelperStore().handleIssuesLocalFilters;

  it("returns undefined when there is no entry", () => {
    localStorage.setItem(KEY, JSON.stringify([entry]));
    expect(get(EIssuesStoreType.ARCHIVED, "ws", "p2", undefined)).toBeUndefined();
    expect(get(EIssuesStoreType.PROFILE, "ws", "p1", undefined)).toBeUndefined();
  });

  it("returns undefined when the storage is malformed", () => {
    localStorage.setItem(KEY, "{not json");
    expect(get(EIssuesStoreType.ARCHIVED, "ws", "p1", undefined)).toBeUndefined();
  });

  it("creates an entry and merges later updates by filter type", () => {
    set(EIssuesStoreType.ARCHIVED, EIssueFilterType.FILTERS, "ws", "p1", undefined, {
      rich_filters: { state_id__in: "s1" },
    });
    set(EIssuesStoreType.ARCHIVED, EIssueFilterType.DISPLAY_FILTERS, "ws", "p1", undefined, {
      display_filters: { layout: EIssueLayoutTypes.LIST },
    });
    set(EIssuesStoreType.ARCHIVED, EIssueFilterType.FILTERS, "ws", "p1", undefined, {
      rich_filters: { state_id__in: "s2" },
    });
    set(EIssuesStoreType.ARCHIVED, EIssueFilterType.FILTERS, "ws", "p2", undefined, {
      rich_filters: {},
    });

    expect(get(EIssuesStoreType.ARCHIVED, "ws", "p1", undefined)).toEqual({
      rich_filters: { state_id__in: "s2" },
      display_filters: { layout: EIssueLayoutTypes.LIST },
    });
    expect(get(EIssuesStoreType.ARCHIVED, "ws", "p2", undefined)).toEqual({ rich_filters: {} });
  });

  it("replaces malformed storage on set", () => {
    localStorage.setItem(KEY, JSON.stringify({ broken: true }));
    set(EIssuesStoreType.PROFILE, EIssueFilterType.KANBAN_FILTERS, "ws", "u1", undefined, {
      kanban_filters: { group_by: ["a"], sub_group_by: [] },
    });

    expect(parseLocalIssueFilters(localStorage.getItem(KEY) ?? undefined)).toEqual([
      {
        key: EIssuesStoreType.PROFILE,
        workspaceSlug: "ws",
        viewId: "u1",
        userId: undefined,
        filters: { kanban_filters: { group_by: ["a"], sub_group_by: [] } },
      },
    ]);
  });
});
