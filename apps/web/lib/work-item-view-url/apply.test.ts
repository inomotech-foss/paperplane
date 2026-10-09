// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { observable } from "mobx";
import { describe, expect, it, vi } from "vitest";
import type { IIssueFilters } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { IssueFilterHelperStore } from "@/store/issue/helpers/issue-filter-helper.store";
import { applyViewState, diffViewState, getUnverifiedPql, resolveViewState, toViewState } from "./apply";
import type { TViewStateStore } from "./apply";
import { getPageBaseline, getWorkItemPage } from "./pages";
import { parseSearch } from "./serialize";
import type { TWorkItemViewState } from "./types";

const page = getWorkItemPage(EIssuesStoreType.PROJECT);
const baseline = getPageBaseline(page);
const CUSTOM = "custom_property_6f1c2a52-6d0c-4b8e-9f43-1d1f0e7f8b10";

const saved: TWorkItemViewState = {
  displayFilters: {
    ...baseline.displayFilters,
    layout: EIssueLayoutTypes.KANBAN,
    group_by: "priority",
    sub_group_by: "labels",
    order_by: "-priority",
    sub_issue: false,
    calendar: { layout: "week", show_weekends: true },
    pql: 'state = "Done"',
  },
  displayProperties: { ...baseline.displayProperties, labels: false, [CUSTOM]: true },
  richFilters: { state_id__in: "s1" },
};

const resolve = (search: string) =>
  resolveViewState(parseSearch(new URLSearchParams(search), page), page, baseline, saved);

describe("resolveViewState", () => {
  it("uses the saved preferences without view params", () => {
    expect(resolve("").state).toEqual(saved);
    expect(resolve("other=1").state).toEqual(saved);
  });

  it("takes shown fields from the URL and its baseline", () => {
    const { state, invalid } = resolve("l=list&o=-created_at");
    expect(invalid).toEqual([]);
    expect(state.displayFilters.layout).toBe(EIssueLayoutTypes.LIST);
    expect(state.displayFilters.order_by).toBe("-created_at");
    // shown in list, missing from the URL: the baseline
    expect(state.displayFilters.group_by).toBe(baseline.displayFilters.group_by);
    expect(state.displayFilters.sub_issue).toBe(baseline.displayFilters.sub_issue);
    expect(state.displayFilters.pql).toBe(baseline.displayFilters.pql);
    expect(state.displayProperties.labels).toBe(true);
    expect(state.richFilters).toEqual(baseline.richFilters);
    expect(state.displayProperties[CUSTOM]).toBeUndefined();
  });

  it("keeps the saved preferences for fields the layout does not show", () => {
    const { state } = resolve("l=list&g=state");
    expect(state.displayFilters.calendar).toEqual({ layout: "week", show_weekends: true });
    expect(state.displayFilters.sub_group_by).toBe("labels");

    const calendar = resolve("l=calendar&cal=month").state;
    expect(calendar.displayFilters.group_by).toBe("priority");
    expect(calendar.displayFilters.calendar).toEqual({ layout: "month", show_weekends: true });
  });

  it("applies rich filters, PQL and custom properties from the URL", () => {
    const { state } = resolve(
      "l=list&f=priority:in:urgent&q=type+%3D+%22Bug%22&p=cp.6f1c2a52-6d0c-4b8e-9f43-1d1f0e7f8b10"
    );
    expect(state.richFilters).toEqual({ priority__in: "urgent" });
    expect(state.displayFilters.pql).toBe('type = "Bug"');
    expect(state.displayProperties[CUSTOM]).toBe(true);
  });

  it("drops invalid params", () => {
    const { state, invalid } = resolve("l=list&g=nope&x=bogus");
    expect(invalid.map(({ param }) => param)).toEqual(["g", "x"]);
    expect(state.displayFilters.group_by).toBe(baseline.displayFilters.group_by);
  });
});

describe("getUnverifiedPql", () => {
  it("only asks for queries not applied before", () => {
    const state = (pql: string) => ({ ...saved, displayFilters: { ...saved.displayFilters, pql } });
    expect(getUnverifiedPql(state(" new "), [saved])).toBe("new");
    expect(getUnverifiedPql(state('state = "Done" '), [saved])).toBeUndefined();
    expect(getUnverifiedPql(state(""), [saved])).toBeUndefined();
  });
});

describe("diffViewState", () => {
  it("lists changed keys only", () => {
    const next = {
      ...saved,
      displayFilters: { ...saved.displayFilters, order_by: "priority" as const },
      displayProperties: { ...saved.displayProperties, [CUSTOM]: undefined },
    };
    const diff = diffViewState(saved, next);
    expect(diff.displayFilters).toEqual({ order_by: "priority" });
    expect(diff.displayProperties).toEqual({ [CUSTOM]: undefined });
    expect(diff.richFilters).toBe(false);
  });
});

const makeStore = (filters: Record<string, IIssueFilters> = {}): TViewStateStore => {
  const helper = new IssueFilterHelperStore();
  return {
    filters: observable(filters),
    getShouldClearIssues: helper.getShouldClearIssues,
    getShouldReFetchIssues: helper.getShouldReFetchIssues,
  };
};

const makeEffects = () => ({ clear: vi.fn(), refetch: vi.fn(), setRichFilters: vi.fn() });

const shown = (): IIssueFilters => ({
  richFilters: saved.richFilters ?? {},
  displayFilters: saved.displayFilters,
  displayProperties: saved.displayProperties,
  kanbanFilters: { group_by: ["collapsed"], sub_group_by: [] },
});

describe("applyViewState", () => {
  it("replaces the filters while the list is not shown", () => {
    const store = makeStore();
    const next = resolve("l=list").state;
    applyViewState(store, "p1", next);
    expect(toViewState(store.filters.p1)).toEqual({ ...next, richFilters: {} });
  });

  it("clears on a layout change and lets the new layout fetch", () => {
    const store = makeStore({ p1: shown() });
    const effects = makeEffects();
    applyViewState(store, "p1", resolve("l=list&o=-priority").state, effects);
    expect(store.filters.p1.displayFilters?.layout).toBe(EIssueLayoutTypes.LIST);
    expect(store.filters.p1.kanbanFilters?.group_by).toEqual(["collapsed"]);
    expect(effects.clear).toHaveBeenCalledOnce();
    expect(effects.refetch).not.toHaveBeenCalled();
  });

  it("refetches for server side changes and mirrors rich filters", () => {
    const store = makeStore({ p1: shown() });
    const effects = makeEffects();
    const next = { ...saved, richFilters: { priority__in: "high" } };
    applyViewState(store, "p1", next, effects);
    expect(store.filters.p1.richFilters).toEqual({ priority__in: "high" });
    expect(effects.setRichFilters).toHaveBeenCalledWith({ priority__in: "high" });
    expect(effects.refetch).toHaveBeenCalledOnce();
    expect(effects.clear).not.toHaveBeenCalled();
  });

  it("does nothing when the state is already shown", () => {
    const store = makeStore({ p1: shown() });
    const effects = makeEffects();
    applyViewState(store, "p1", saved, effects);
    expect(effects.refetch).not.toHaveBeenCalled();
    expect(effects.clear).not.toHaveBeenCalled();
    expect(effects.setRichFilters).not.toHaveBeenCalled();
  });
});
