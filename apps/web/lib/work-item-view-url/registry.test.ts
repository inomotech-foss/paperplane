// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { EIssuesStoreType } from "@plane/types";
import { getWorkItemPage } from "./pages";
import { getViewRoute, registerViewRoute } from "./registry";

const project = getWorkItemPage(EIssuesStoreType.PROJECT);
const cycle = getWorkItemPage(EIssuesStoreType.CYCLE);
const route = () => ({ onIntent: async () => {} });

describe("view route registry", () => {
  it("keys routes by page and entity", () => {
    const first = route();
    const cleanup = registerViewRoute(project, "p1", first);
    expect(getViewRoute(project, "p1")).toBe(first);
    expect(getViewRoute(cycle, "p1")).toBeUndefined();
    expect(getViewRoute(project, "p2")).toBeUndefined();
    cleanup();
    expect(getViewRoute(project, "p1")).toBeUndefined();
  });

  it("removes only its own registration", () => {
    const first = route();
    const second = route();
    const cleanupFirst = registerViewRoute(project, "p1", first);
    const cleanupSecond = registerViewRoute(project, "p1", second);
    cleanupFirst();
    expect(getViewRoute(project, "p1")).toBe(second);
    cleanupSecond();
    expect(getViewRoute(project, "p1")).toBeUndefined();
  });

  it("makes the earlier registration active again when the later one leaves", () => {
    const first = route();
    const second = route();
    const cleanupFirst = registerViewRoute(project, "p1", first);
    const cleanupSecond = registerViewRoute(project, "p1", second);
    expect(getViewRoute(project, "p1")).toBe(second);
    cleanupSecond();
    expect(getViewRoute(project, "p1")).toBe(first);
    cleanupFirst();
    expect(getViewRoute(project, "p1")).toBeUndefined();
  });
});
