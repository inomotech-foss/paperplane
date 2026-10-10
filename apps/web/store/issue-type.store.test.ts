// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { IProjectUserPropertiesResponse, TIssueType } from "@plane/types";
import { IssueTypeStore } from "./issue-type.store";

const makeType = (id: string, level: number, isActive = true): TIssueType => ({
  id,
  name: id,
  description: "",
  logo_props: { in_use: "icon" },
  is_epic: false,
  is_active: isActive,
  level,
  project: "p1",
  workspace: "ws",
});

const makeProperties = (lastTypeId?: string): IProjectUserPropertiesResponse => ({
  rich_filters: {},
  display_filters: {},
  display_properties: {},
  sort_order: 0,
  preferences: {
    pages: { block_display: true },
    navigation: { default_tab: "work_items", hide_in_more_menu: [] },
    ...(lastTypeId ? { work_items: { last_type_id: lastTypeId } } : {}),
  },
});

const makeStore = (properties: IProjectUserPropertiesResponse | null) => {
  const project = {
    getProjectUserProperties: vi.fn(() => properties),
    fetchProjectUserProperties: vi.fn(() => Promise.resolve(makeProperties())),
    updateProjectUserProperties: vi.fn(
      (_slug: string, _projectId: string, data: Partial<IProjectUserPropertiesResponse>) =>
        Promise.resolve({ ...makeProperties(), ...data })
    ),
  };
  const store = new IssueTypeStore({ memberRoot: { project } });
  store.typeMap = { task: makeType("task", 0), bug: makeType("bug", 1), old: makeType("old", 2, false) };
  store.fetchedMap = { p1: true };
  return { store, project };
};

describe("IssueTypeStore.getPreselectedIssueTypeId", () => {
  it("preselects the type last used in the project", () => {
    const { store } = makeStore(makeProperties("bug"));
    expect(store.getPreselectedIssueTypeId("p1")).toBe("bug");
  });

  it("falls back to the first active type", () => {
    expect(makeStore(makeProperties()).store.getPreselectedIssueTypeId("p1")).toBe("task");
    expect(makeStore(makeProperties("old")).store.getPreselectedIssueTypeId("p1")).toBe("task");
    expect(makeStore(null).store.getPreselectedIssueTypeId("p1")).toBe("task");
  });

  it("has no default type to fall back on", () => {
    const { store } = makeStore(makeProperties());
    expect(store.getIssueTypeById(null)).toBeNull();
    expect("getProjectDefaultIssueType" in store).toBe(false);
  });
});

describe("IssueTypeStore.rememberIssueType", () => {
  it("saves the type next to the other preferences", async () => {
    const properties = makeProperties("task");
    const { store, project } = makeStore(properties);

    await store.rememberIssueType("ws", "p1", "bug");

    expect(project.updateProjectUserProperties).toHaveBeenCalledWith("ws", "p1", {
      preferences: { ...properties.preferences, work_items: { last_type_id: "bug" } },
    });
  });

  it("does not save the type it already has", async () => {
    const { store, project } = makeStore(makeProperties("bug"));

    await store.rememberIssueType("ws", "p1", "bug");

    expect(project.updateProjectUserProperties).not.toHaveBeenCalled();
  });

  it("loads the preferences before it saves", async () => {
    const { store, project } = makeStore(null);

    await store.rememberIssueType("ws", "p1", "bug");

    expect(project.fetchProjectUserProperties).toHaveBeenCalledWith("ws", "p1");
    expect(project.updateProjectUserProperties).toHaveBeenCalledWith("ws", "p1", {
      preferences: { ...makeProperties().preferences, work_items: { last_type_id: "bug" } },
    });
  });
});
