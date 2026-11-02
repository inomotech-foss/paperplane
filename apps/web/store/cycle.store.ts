/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isPast, isToday } from "date-fns";
import { sortBy, set, isEmpty } from "lodash-es";
import { action, computed, observable, makeObservable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type {
  ICycle,
  IFavorite,
  TCyclePlotType,
  TProgressSnapshot,
  TCycleEstimateDistribution,
  TCycleDistribution,
  TCycleEstimateType,
} from "@plane/types";
import type { DistributionUpdates } from "@plane/utils";
import { orderCycles, shouldFilterCycle, getDate, updateDistribution } from "@plane/utils";
// helpers
// services
import { CycleService } from "@/services/cycle.service";
import { CycleArchiveService } from "@/services/cycle_archive.service";
import { IssueService } from "@/services/issue";
import { ProjectService } from "@/services/project";
// store
import type { CoreRootStore } from "./root.store";

export type TCycleRootStore = {
  router: Pick<CoreRootStore["router"], "projectId">;
  cycleFilter: Pick<
    CoreRootStore["cycleFilter"],
    "archivedCyclesSearchQuery" | "getArchivedFiltersByProjectId" | "getFiltersByProjectId" | "searchQuery"
  >;
  favorite: Pick<
    CoreRootStore["favorite"],
    "addFavorite" | "entityMap" | "removeFavoriteEntity" | "removeFavoriteFromStore"
  >;
  projectEstimate: Pick<CoreRootStore["projectEstimate"], "areEstimateEnabledByProjectId">;
};

export interface ICycleStore {
  // loaders
  progressLoader: boolean;
  // observables
  cycleMap: Record<string, ICycle>;
  plotType: Record<string, TCyclePlotType>;
  estimatedType: Record<string, TCycleEstimateType>;
  activeCycleIdMap: Record<string, boolean>;

  // computed
  currentProjectCycleIds: string[];
  currentProjectCompletedCycleIds: string[];
  currentProjectIncompleteCycleIds: string[];
  currentProjectActiveCycleId: string | null;
  currentProjectArchivedCycleIds: string[];
  currentProjectActiveCycle: ICycle | null;

  // computed actions
  getFilteredCycleIds: (projectId: string, sortByManual: boolean) => string[];
  getFilteredCompletedCycleIds: (projectId: string) => string[];
  getFilteredArchivedCycleIds: (projectId: string) => string[];
  getCycleById: (cycleId: string) => ICycle | null;
  getCycleNameById: (cycleId: string) => string | undefined;
  getProjectCycleDetails: (projectId: string) => ICycle[];
  getProjectCycleIds: (projectId: string) => string[];
  getPlotTypeByCycleId: (cycleId: string) => TCyclePlotType;
  getEstimateTypeByCycleId: (cycleId: string) => TCycleEstimateType;
  getIsPointsDataAvailable: (cycleId: string) => boolean;

  // actions
  updateCycleDistribution: (distributionUpdates: DistributionUpdates, cycleId: string) => void;
  setPlotType: (cycleId: string, plotType: TCyclePlotType) => void;
  setEstimateType: (cycleId: string, estimateType: TCycleEstimateType) => void;
  // fetch
  fetchWorkspaceCycles: (workspaceSlug: string) => Promise<ICycle[]>;
  fetchAllCycles: (workspaceSlug: string, projectId: string) => Promise<ICycle[]>;
  fetchActiveCycle: (workspaceSlug: string, projectId: string) => Promise<ICycle[]>;
  fetchArchivedCycles: (workspaceSlug: string, projectId: string) => Promise<ICycle[]>;
  fetchArchivedCycleDetails: (workspaceSlug: string, projectId: string, cycleId: string) => Promise<ICycle>;
  fetchCycleDetails: (workspaceSlug: string, projectId: string, cycleId: string) => Promise<ICycle>;
  fetchActiveCycleProgress: (workspaceSlug: string, projectId: string, cycleId: string) => Promise<TProgressSnapshot>;
  fetchActiveCycleProgressPro: (workspaceSlug: string, projectId: string, cycleId: string) => Promise<void>;
  fetchActiveCycleAnalytics: (
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    analyticType: TCycleEstimateType
  ) => Promise<TCycleDistribution | TCycleEstimateDistribution>;
  // crud
  createCycle: (workspaceSlug: string, projectId: string, data: Partial<ICycle>) => Promise<ICycle>;
  updateCycleDetails: (
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    data: Partial<ICycle>
  ) => Promise<ICycle>;
  deleteCycle: (workspaceSlug: string, projectId: string, cycleId: string) => Promise<void>;
  // favorites
  addCycleToFavorites: (workspaceSlug: string, projectId: string, cycleId: string) => Promise<IFavorite>;
  removeCycleFromFavorites: (workspaceSlug: string, projectId: string, cycleId: string) => Promise<void>;
  // archive
  archiveCycle: (workspaceSlug: string, projectId: string, cycleId: string) => Promise<void>;
  restoreCycle: (workspaceSlug: string, projectId: string, cycleId: string) => Promise<void>;
}

export class CycleStore implements ICycleStore {
  // observables
  progressLoader: boolean = false;
  cycleMap: Record<string, ICycle> = {};
  plotType: Record<string, TCyclePlotType> = {};
  estimatedType: Record<string, TCycleEstimateType> = {};
  activeCycleIdMap: Record<string, boolean> = {};
  // root store
  rootStore;
  // services
  projectService;
  issueService;
  cycleService;
  cycleArchiveService;

  constructor(_rootStore: TCycleRootStore) {
    makeObservable(this, {
      // observables
      progressLoader: observable,
      cycleMap: observable,
      plotType: observable,
      estimatedType: observable,
      activeCycleIdMap: observable,
      // computed
      currentProjectCycleIds: computed,
      currentProjectCompletedCycleIds: computed,
      currentProjectIncompleteCycleIds: computed,
      currentProjectActiveCycleId: computed,
      currentProjectArchivedCycleIds: computed,
      currentProjectActiveCycle: computed,

      // actions
      setPlotType: action,
      setEstimateType: action,
      fetchWorkspaceCycles: action,
      fetchAllCycles: action,
      fetchActiveCycle: action,
      fetchArchivedCycles: action,
      fetchArchivedCycleDetails: action,
      fetchActiveCycleProgress: action,
      fetchActiveCycleAnalytics: action,
      fetchCycleDetails: action,
      updateCycleDetails: action,
      deleteCycle: action,
      addCycleToFavorites: action,
      removeCycleFromFavorites: action,
      archiveCycle: action,
      restoreCycle: action,
    });

    this.rootStore = _rootStore;

    // services
    this.projectService = new ProjectService();
    this.issueService = new IssueService();
    this.cycleService = new CycleService();
    this.cycleArchiveService = new CycleArchiveService();
  }

  /** All cycles of a project, archived included. Every per-project list derives from this one pass. */
  private getAllProjectCycles = computedFn((projectId: string): ICycle[] =>
    Object.values(this.cycleMap).filter((c) => c.project_id === projectId)
  );

  // computed
  get currentProjectCycleIds() {
    const projectId = this.rootStore.router.projectId;
    return projectId ? this.getProjectCycleIds(projectId) : [];
  }

  get currentProjectCompletedCycleIds() {
    const projectId = this.rootStore.router.projectId;
    if (!projectId) return [];
    const completedCycles = this.getAllProjectCycles(projectId).filter((c) => {
      const endDate = getDate(c.end_date);
      const hasEndDatePassed = endDate && isPast(endDate);
      const isEndDateToday = endDate && isToday(endDate);
      return (hasEndDatePassed && !isEndDateToday) || c.status?.toLowerCase() === "completed";
    });
    return sortBy(completedCycles, [(c) => c.sort_order]).map((c) => c.id);
  }

  get currentProjectIncompleteCycleIds() {
    const projectId = this.rootStore.router.projectId;
    if (!projectId) return [];
    const incompleteCycles = this.getAllProjectCycles(projectId).filter((c) => {
      const endDate = getDate(c.end_date);
      const hasEndDatePassed = endDate && isPast(endDate);
      return !hasEndDatePassed && !c.archived_at && c.status?.toLowerCase() !== "completed";
    });
    return sortBy(incompleteCycles, [(c) => c.sort_order]).map((c) => c.id);
  }

  get currentProjectActiveCycleId() {
    const projectId = this.rootStore.router.projectId;
    if (!projectId) return null;
    const activeCycle = this.getAllProjectCycles(projectId).find((c) => c.status?.toLowerCase() === "current");
    return activeCycle?.id ?? null;
  }

  get currentProjectArchivedCycleIds() {
    const projectId = this.rootStore.router.projectId;
    if (!projectId) return [];
    const archivedCycles = this.getAllProjectCycles(projectId).filter((c) => !!c.archived_at);
    return sortBy(archivedCycles, [(c) => c.sort_order]).map((c) => c.id);
  }

  get currentProjectActiveCycle() {
    const activeCycleId = this.currentProjectActiveCycleId;
    return activeCycleId ? (this.cycleMap[activeCycleId] ?? null) : null;
  }

  getIsPointsDataAvailable = computedFn((cycleId: string) => {
    const cycle = this.getCycleById(cycleId);
    if (!cycle) return false;
    if (cycle.version === 2) return cycle.progress?.some((p) => p.total_estimate_points > 0) ?? false;
    else if (cycle.version === 1) {
      const completionChart = cycle.estimate_distribution?.completion_chart || {};
      return !isEmpty(completionChart) && Object.keys(completionChart).some((p) => completionChart[p]! > 0);
    } else return false;
  });

  /** Non-archived cycle ids of a project that match the search and filters. */
  getFilteredCycleIds = computedFn((projectId: string, sortByManual: boolean) => {
    const filters = this.rootStore.cycleFilter.getFiltersByProjectId(projectId) ?? {};
    const searchQuery = this.rootStore.cycleFilter.searchQuery.toLowerCase();
    const cycles = this.getAllProjectCycles(projectId).filter(
      (c) => !c.archived_at && c.name.toLowerCase().includes(searchQuery) && shouldFilterCycle(c, filters)
    );
    return orderCycles(cycles, sortByManual).map((c) => c.id);
  });

  /** Completed, non-archived cycle ids of a project that match the search and filters. */
  getFilteredCompletedCycleIds = computedFn((projectId: string) => {
    const filters = this.rootStore.cycleFilter.getFiltersByProjectId(projectId) ?? {};
    const searchQuery = this.rootStore.cycleFilter.searchQuery.toLowerCase();
    const cycles = this.getAllProjectCycles(projectId).filter(
      (c) =>
        !c.archived_at &&
        c.status?.toLowerCase() === "completed" &&
        c.name.toLowerCase().includes(searchQuery) &&
        shouldFilterCycle(c, filters)
    );
    return sortBy(cycles, [(c) => !c.start_date]).map((c) => c.id);
  });

  /** Archived cycle ids of a project that match the archive search and filters. */
  getFilteredArchivedCycleIds = computedFn((projectId: string) => {
    const filters = this.rootStore.cycleFilter.getArchivedFiltersByProjectId(projectId) ?? {};
    const searchQuery = this.rootStore.cycleFilter.archivedCyclesSearchQuery.toLowerCase();
    const cycles = this.getAllProjectCycles(projectId).filter(
      (c) => !!c.archived_at && c.name.toLowerCase().includes(searchQuery) && shouldFilterCycle(c, filters)
    );
    return sortBy(cycles, [(c) => !c.start_date]).map((c) => c.id);
  });

  getCycleById = computedFn((cycleId: string): ICycle | null => this.cycleMap[cycleId] ?? null);

  getCycleNameById = computedFn((cycleId: string): string | undefined => this.cycleMap[cycleId]?.name);

  /** Non-archived cycles of a project, in manual order. Whether the list is complete is the query's concern. */
  getProjectCycleDetails = computedFn((projectId: string): ICycle[] => {
    const cycles = this.getAllProjectCycles(projectId).filter((c) => !c.archived_at);
    return sortBy(cycles, [(c) => c.sort_order]);
  });

  getProjectCycleIds = computedFn((projectId: string): string[] =>
    this.getProjectCycleDetails(projectId).map((c) => c.id)
  );

  /**
   * @description gets the plot type for the cycle store
   * @param {TCyclePlotType} plotType
   */
  getPlotTypeByCycleId = computedFn((cycleId: string) => this.plotType[cycleId] || "burndown");

  /**
   * @description gets the estimate type for the cycle store
   * @param {TCycleEstimateType} estimateType
   */
  getEstimateTypeByCycleId = computedFn((cycleId: string) => {
    const { projectId } = this.rootStore.router;

    return projectId && this.rootStore.projectEstimate.areEstimateEnabledByProjectId(projectId)
      ? this.estimatedType[cycleId] || "issues"
      : "issues";
  });

  /**
   * @description updates the plot type for the cycle store
   * @param {TCyclePlotType} plotType
   */
  setPlotType = (cycleId: string, plotType: TCyclePlotType) => {
    set(this.plotType, [cycleId], plotType);
  };

  /**
   * @description updates the estimate type for the cycle store
   * @param {TCycleEstimateType} estimateType
   */
  setEstimateType = (cycleId: string, estimateType: TCycleEstimateType) => {
    set(this.estimatedType, [cycleId], estimateType);
  };

  /**
   * @description fetch all cycles
   * @param workspaceSlug
   * @returns ICycle[]
   */
  fetchWorkspaceCycles = async (workspaceSlug: string) => {
    const response = await this.cycleService.getWorkspaceCycles(workspaceSlug);
    runInAction(() => {
      response.forEach((cycle) => {
        set(this.cycleMap, [cycle.id], { ...this.cycleMap[cycle.id], ...cycle });
      });
    });
    return response;
  };

  /**
   * @description fetches all cycles for a project
   * @param workspaceSlug
   * @param projectId
   * @returns
   */
  fetchAllCycles = async (workspaceSlug: string, projectId: string) => {
    const response = await this.cycleService.getCyclesWithParams(workspaceSlug, projectId);
    runInAction(() => {
      response.forEach((cycle) => {
        set(this.cycleMap, [cycle.id], cycle);
        if (cycle.status?.toLowerCase() === "current") {
          set(this.activeCycleIdMap, [cycle.id], true);
        }
      });
    });
    return response;
  };

  /**
   * @description fetches archived cycles for a project
   * @param workspaceSlug
   * @param projectId
   * @returns
   */
  fetchArchivedCycles = async (workspaceSlug: string, projectId: string) => {
    const response = await this.cycleArchiveService.getArchivedCycles(workspaceSlug, projectId);
    runInAction(() => {
      response.forEach((cycle) => {
        set(this.cycleMap, [cycle.id], cycle);
      });
    });
    return response;
  };

  /**
   * @description fetches active cycle for a project
   * @param workspaceSlug
   * @param projectId
   * @returns
   */
  fetchActiveCycle = async (workspaceSlug: string, projectId: string) =>
    await this.cycleService.getCyclesWithParams(workspaceSlug, projectId, "current").then((response) => {
      runInAction(() => {
        response.forEach((cycle) => {
          set(this.activeCycleIdMap, [cycle.id], true);
          set(this.cycleMap, [cycle.id], cycle);
        });
      });
      return response;
    });

  /**
   * @description fetches active cycle progress
   * @param workspaceSlug
   * @param projectId
   * @param cycleId
   *  @returns
   */
  fetchActiveCycleProgress = async (workspaceSlug: string, projectId: string, cycleId: string) => {
    this.progressLoader = true;
    return await this.cycleService.getCycleProgress(workspaceSlug, projectId, cycleId).then((progress) => {
      runInAction(() => {
        set(this.cycleMap, [cycleId], { ...this.cycleMap[cycleId], ...progress });
        this.progressLoader = false;
      });
      return progress;
    });
  };

  /**
   * @description fetches active cycle progress for pro users
   * @param workspaceSlug
   * @param projectId
   * @param cycleId
   *  @returns
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fetchActiveCycleProgressPro = action(async (workspaceSlug: string, projectId: string, cycleId: string) => {});

  /**
   * @description fetches active cycle analytics
   * @param workspaceSlug
   * @param projectId
   * @param cycleId
   *  @returns
   */
  fetchActiveCycleAnalytics = async (
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    analyticType: TCycleEstimateType
  ) => {
    if (analyticType === "points") {
      const distribution = await this.cycleService.getCycleEstimateDistribution(workspaceSlug, projectId, cycleId);
      runInAction(() => {
        set(this.cycleMap, [cycleId, "estimate_distribution"], distribution);
      });
      return distribution;
    }
    const distribution = await this.cycleService.getCycleDistribution(workspaceSlug, projectId, cycleId);
    runInAction(() => {
      set(this.cycleMap, [cycleId, "distribution"], distribution);
    });
    return distribution;
  };

  /**
   * @description fetches cycle details
   * @param workspaceSlug
   * @param projectId
   * @param cycleId
   * @returns
   */
  fetchArchivedCycleDetails = async (workspaceSlug: string, projectId: string, cycleId: string) =>
    await this.cycleArchiveService.getArchivedCycleDetails(workspaceSlug, projectId, cycleId).then((response) => {
      runInAction(() => {
        set(this.cycleMap, [response.id], { ...this.cycleMap?.[response.id], ...response });
      });
      return response;
    });

  /**
   * @description fetches cycle details
   * @param workspaceSlug
   * @param projectId
   * @param cycleId
   * @returns
   */
  fetchCycleDetails = async (workspaceSlug: string, projectId: string, cycleId: string) =>
    await this.cycleService.getCycleDetails(workspaceSlug, projectId, cycleId).then((response) => {
      runInAction(() => {
        set(this.cycleMap, [response.id], { ...this.cycleMap?.[response.id], ...response });
      });
      return response;
    });

  /**
   * This method updates the cycle's stats locally without fetching the updated stats from backend
   * @param distributionUpdates
   * @param cycleId
   * @returns
   */
  updateCycleDistribution = (distributionUpdates: DistributionUpdates, cycleId: string) => {
    const cycle = this.getCycleById(cycleId);
    if (!cycle) return;

    runInAction(() => {
      updateDistribution(cycle, distributionUpdates);
    });
  };

  /**
   * @description creates a new cycle
   * @param workspaceSlug
   * @param projectId
   * @param data
   * @returns
   */
  createCycle = action(
    async (workspaceSlug: string, projectId: string, data: Partial<ICycle>) =>
      await this.cycleService.createCycle(workspaceSlug, projectId, data).then((response) => {
        runInAction(() => {
          set(this.cycleMap, [response.id], response);
        });
        return response;
      })
  );

  /**
   * @description updates cycle details
   * @param workspaceSlug
   * @param projectId
   * @param cycleId
   * @param data
   * @returns
   */
  updateCycleDetails = async (workspaceSlug: string, projectId: string, cycleId: string, data: Partial<ICycle>) => {
    try {
      runInAction(() => {
        set(this.cycleMap, [cycleId], { ...this.cycleMap?.[cycleId], ...data });
      });
      const response = await this.cycleService.patchCycle(workspaceSlug, projectId, cycleId, data);
      this.fetchCycleDetails(workspaceSlug, projectId, cycleId);
      return response;
    } catch (error) {
      console.log("Failed to patch cycle from cycle store");
      this.fetchAllCycles(workspaceSlug, projectId).catch(() => undefined);
      this.fetchActiveCycle(workspaceSlug, projectId).catch(() => undefined);
      throw error;
    }
  };

  /**
   * @description deletes a cycle
   * @param workspaceSlug
   * @param projectId
   * @param cycleId
   */
  deleteCycle = async (workspaceSlug: string, projectId: string, cycleId: string) => {
    await this.cycleService.deleteCycle(workspaceSlug, projectId, cycleId);
    runInAction(() => {
      delete this.cycleMap[cycleId];
      delete this.activeCycleIdMap[cycleId];
      if (this.rootStore.favorite.entityMap[cycleId]) this.rootStore.favorite.removeFavoriteFromStore(cycleId);
    });
  };

  /**
   * @description adds a cycle to favorites
   * @param workspaceSlug
   * @param projectId
   * @param cycleId
   * @returns
   */
  addCycleToFavorites = async (workspaceSlug: string, projectId: string, cycleId: string) => {
    const currentCycle = this.getCycleById(cycleId);
    try {
      runInAction(() => {
        if (currentCycle) set(this.cycleMap, [cycleId, "is_favorite"], true);
      });
      // updating through api.
      const response = await this.rootStore.favorite.addFavorite(workspaceSlug.toString(), {
        entity_type: "cycle",
        entity_identifier: cycleId,
        project_id: projectId,
        entity_data: { name: currentCycle?.name || "" },
      });
      return response;
    } catch (error) {
      runInAction(() => {
        if (currentCycle) set(this.cycleMap, [cycleId, "is_favorite"], false);
      });
      throw error;
    }
  };

  /**
   * @description removes a cycle from favorites
   * @param workspaceSlug
   * @param projectId
   * @param cycleId
   * @returns
   */
  removeCycleFromFavorites = async (workspaceSlug: string, projectId: string, cycleId: string) => {
    const currentCycle = this.getCycleById(cycleId);
    try {
      runInAction(() => {
        if (currentCycle) set(this.cycleMap, [cycleId, "is_favorite"], false);
      });
      const response = await this.rootStore.favorite.removeFavoriteEntity(workspaceSlug, cycleId);
      return response;
    } catch (error) {
      runInAction(() => {
        if (currentCycle) set(this.cycleMap, [cycleId, "is_favorite"], true);
      });
      throw error;
    }
  };

  /**
   * @description archives a cycle
   * @param workspaceSlug
   * @param projectId
   * @param cycleId
   * @returns
   */
  archiveCycle = async (workspaceSlug: string, projectId: string, cycleId: string) => {
    const cycleDetails = this.getCycleById(cycleId);
    if (cycleDetails?.archived_at) return;
    try {
      const response = await this.cycleArchiveService.archiveCycle(workspaceSlug, projectId, cycleId);
      runInAction(() => {
        set(this.cycleMap, [cycleId, "archived_at"], response.archived_at);
        if (this.rootStore.favorite.entityMap[cycleId]) this.rootStore.favorite.removeFavoriteFromStore(cycleId);
      });
    } catch (error) {
      console.error("Failed to archive cycle in cycle store", error);
    }
  };

  /**
   * @description restores a cycle
   * @param workspaceSlug
   * @param projectId
   * @param cycleId
   * @returns
   */
  restoreCycle = async (workspaceSlug: string, projectId: string, cycleId: string) => {
    const cycleDetails = this.getCycleById(cycleId);
    if (!cycleDetails?.archived_at) return;
    try {
      await this.cycleArchiveService.restoreCycle(workspaceSlug, projectId, cycleId);
      runInAction(() => {
        set(this.cycleMap, [cycleId, "archived_at"], null);
      });
    } catch (error) {
      console.error("Failed to restore cycle in cycle store", error);
    }
  };
}
