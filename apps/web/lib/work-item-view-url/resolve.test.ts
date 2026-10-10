// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { IIssueFilters } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType, EStartOfTheWeek } from "@plane/types";
import { getPageBaseline, getWorkItemPage } from "./pages";
import { resolveViewRoute } from "./resolve";
import type { TViewDeps } from "./resolve";

const page = getWorkItemPage(EIssuesStoreType.PROJECT);
const CLOCK = { today: "2026-10-09", weekStart: EStartOfTheWeek.MONDAY };
const INVALID = "nope = 1";

const SAVED: IIssueFilters = {
  richFilters: {},
  displayFilters: { layout: EIssueLayoutTypes.KANBAN, group_by: "priority", pql: "state = 'Done'" },
  displayProperties: getPageBaseline(page).displayProperties,
  kanbanFilters: undefined,
};

const deps = (overrides: Partial<TViewDeps> = {}): TViewDeps => ({
  loadSaved: async () => SAVED,
  validatePql: async (pql) => (pql === INVALID ? { valid: false, error: "Unknown field" } : { valid: true }),
  clock: () => CLOCK,
  ...overrides,
});

const resolve = (search: string, overrides?: Partial<TViewDeps>) =>
  resolveViewRoute(new URL(`http://localhost/p1/issues${search}`), page, deps(overrides));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveViewRoute", () => {
  it("resolves a plain URL to the saved preferences and their canonical URL", async () => {
    const data = await resolve("");
    expect(data.state.displayFilters.layout).toBe(EIssueLayoutTypes.KANBAN);
    expect(data.canonical).toBe("?l=kanban&g=priority&q=state+%3D+%27Done%27");
    expect(data.clock).toBe(CLOCK);
  });

  it("accepts a canonical URL with a quoted query as it is", async () => {
    const data = await resolve("?l=list&q=priority+%3D+%27high%27");
    expect(data.canonical).toBeUndefined();
    expect(data.state.displayFilters.pql).toBe("priority = 'high'");
  });

  it("keeps an invalid query in the URL and returns it as a draft", async () => {
    const data = await resolve("?l=list&q=nope+%3D+1");
    expect(data.canonical).toBeUndefined();
    expect(data.draft).toEqual({ query: INVALID, error: "Unknown field" });
    expect(data.state.displayFilters.pql ?? "").toBe("");
  });

  it("replaces another spelling of the same URL once", async () => {
    expect((await resolve("?q=nope%20%3D%201&l=list")).canonical).toBe("?l=list&q=nope+%3D+1");
    expect((await resolve("?l=list&q=nope+%3D+1")).canonical).toBeUndefined();
  });

  it("keeps a plain URL plain when the saved preferences fail to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const data = await resolve("", { loadSaved: () => Promise.reject(new Error("forbidden")) });
    expect(data.canonical).toBeUndefined();
    expect(data.state.displayFilters.layout).toBe(EIssueLayoutTypes.LIST);
  });

  it("still canonicalizes an explicit URL when the saved preferences fail to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const data = await resolve("?l=list&o=bogus", { loadSaved: () => Promise.reject(new Error("forbidden")) });
    expect(data.canonical).toBe("?l=list");
  });

  it("validates the query while the saved preferences load", async () => {
    let releaseSaved: (() => void) | undefined;
    const validatePql = vi.fn(async () => ({ valid: true }));
    const pending = resolve("?l=list&q=priority+%3D+high", {
      loadSaved: () =>
        new Promise((done) => {
          releaseSaved = () => done(SAVED);
        }),
      validatePql,
    });
    await vi.waitFor(() => expect(validatePql).toHaveBeenCalledWith("priority = high"));
    releaseSaved?.();
    expect((await pending).canonical).toBeUndefined();
  });
});
