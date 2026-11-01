/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it, vi } from "vitest";
import type { ICycle, IModule } from "@plane/types";
import { CycleStore } from "./cycle.store";
import { ModulesStore } from "./module.store";

const archived = vi.hoisted(() => ({ getArchivedCycles: vi.fn(), getArchivedModules: vi.fn() }));

vi.mock("@/services/cycle_archive.service", () => ({
  CycleArchiveService: class {
    getArchivedCycles = archived.getArchivedCycles;
  },
}));
vi.mock("@/services/module_archive.service", () => ({
  ModuleArchiveService: class {
    getArchivedModules = archived.getArchivedModules;
  },
}));

const favorite = {
  addFavorite: vi.fn(),
  entityMap: {},
  removeFavoriteEntity: vi.fn(),
  removeFavoriteFromStore: vi.fn(),
};
const projectEstimate = { areEstimateEnabledByProjectId: vi.fn() };
const router = { projectId: "p1" };

const cycle: ICycle = {
  id: "c1",
  workspace_id: "w1",
  project_id: "p1",
  name: "Sprint 1",
  description: "",
  start_date: null,
  end_date: null,
  owned_by_id: "u1",
  sort_order: 1,
  archived_at: "2026-10-01T00:00:00Z",
};

const module: IModule = {
  id: "m1",
  workspace_id: "w1",
  project_id: "p1",
  name: "Module 1",
  description: "",
  lead_id: null,
  member_ids: [],
  sort_order: 1,
  start_date: null,
  target_date: null,
  created_at: "",
  updated_at: "",
  total_issues: 0,
  completed_issues: 0,
  backlog_issues: 0,
  started_issues: 0,
  unstarted_issues: 0,
  cancelled_issues: 0,
  archived_at: "2026-10-01T00:00:00Z",
};

describe("archived lists on a direct load", () => {
  it("resolves archived cycles without the main cycle fetch", async () => {
    archived.getArchivedCycles.mockResolvedValueOnce([cycle]);
    const store = new CycleStore({
      router,
      favorite,
      projectEstimate,
      cycleFilter: {
        archivedCyclesSearchQuery: "",
        searchQuery: "",
        getArchivedFiltersByProjectId: vi.fn(),
        getFiltersByProjectId: vi.fn(),
      },
    });
    expect(store.currentProjectArchivedCycleIds).toBeNull();

    await store.fetchArchivedCycles("ws", "p1");

    expect(store.currentProjectArchivedCycleIds).toEqual(["c1"]);
    expect(store.getFilteredArchivedCycleIds("p1")).toEqual(["c1"]);
  });

  it("resolves archived modules without the main module fetch", async () => {
    archived.getArchivedModules.mockResolvedValueOnce([module]);
    const store = new ModulesStore({
      router,
      favorite,
      projectEstimate,
      moduleFilter: {
        archivedModulesSearchQuery: "",
        searchQuery: "",
        getArchivedFiltersByProjectId: vi.fn(),
        getDisplayFiltersByProjectId: () => ({ order_by: "sort_order" }),
        getFiltersByProjectId: vi.fn(),
      },
    });
    expect(store.projectArchivedModuleIds).toBeNull();

    await store.fetchArchivedModules("ws", "p1");

    expect(store.projectArchivedModuleIds).toEqual(["m1"]);
    expect(store.getFilteredArchivedModuleIds("p1")).toEqual(["m1"]);
  });
});
