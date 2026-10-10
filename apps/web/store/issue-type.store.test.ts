// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { IProjectUserPropertiesResponse, TIssue, TIssueType } from "@plane/types";
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

const makeIssue = (id: string, projectId: string, typeId: string): TIssue => ({
  id,
  sequence_id: 1,
  name: id,
  sort_order: 0,
  state_id: null,
  priority: null,
  label_ids: [],
  assignee_ids: [],
  estimate_point: null,
  sub_issues_count: 0,
  attachment_count: 0,
  link_count: 0,
  project_id: projectId,
  parent_id: null,
  cycle_id: null,
  module_ids: null,
  type_id: typeId,
  created_at: "",
  updated_at: "",
  start_date: null,
  target_date: null,
  completed_at: null,
  archived_at: null,
  created_by: "",
  updated_by: "",
  is_draft: false,
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
  const issuesMap: Record<string, TIssue> = {
    mine: makeIssue("mine", "p1", "old"),
    other: makeIssue("other", "p1", "task"),
    elsewhere: makeIssue("elsewhere", "p2", "old"),
  };
  const issues = {
    issuesMap,
    updateIssue: vi.fn((issueId: string, data: Partial<TIssue>) => {
      issuesMap[issueId] = { ...issuesMap[issueId], ...data };
    }),
  };
  const store = new IssueTypeStore({ issue: { issues }, memberRoot: { project } });
  store.removalService.remove = vi.fn(() => Promise.resolve(undefined));
  store.typeMap = { task: makeType("task", 0), bug: makeType("bug", 1), old: makeType("old", 2, false) };
  store.fetchedMap = { p1: true };
  return { store, project, issuesMap };
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

describe("IssueTypeStore.deleteIssueType", () => {
  it("moves the loaded work items of the project to the replacement", async () => {
    const { store, issuesMap } = makeStore(makeProperties());

    await store.deleteIssueType("ws", "p1", "old", "bug");

    expect(store.removalService.remove).toHaveBeenCalledWith("ws", "p1", "old", "bug");
    expect(store.getIssueTypeById("old")).toBeNull();
    expect(issuesMap.mine.type_id).toBe("bug");
    expect(issuesMap.other.type_id).toBe("task");
    expect(issuesMap.elsewhere.type_id).toBe("old");
  });

  it("removes an unused type without a replacement", async () => {
    const { store, issuesMap } = makeStore(makeProperties());

    await store.deleteIssueType("ws", "p1", "old");

    expect(store.removalService.remove).toHaveBeenCalledWith("ws", "p1", "old", undefined);
    expect(issuesMap.mine.type_id).toBe("old");
  });
});
