/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set, sortBy } from "lodash-es";
import { action, computed, observable, makeObservable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { IModule, ILinkDetails, TModulePlotType } from "@plane/types";
import type { DistributionUpdates } from "@plane/utils";
import { updateDistribution, orderModules, shouldFilterModule } from "@plane/utils";
// helpers
// services
import { ModuleService } from "@/services/module.service";
import { ModuleArchiveService } from "@/services/module_archive.service";
import { ProjectService } from "@/services/project";
// store
import type { CoreRootStore } from "./root.store";
import { getModuleOrderBy } from "./timeline-order";

export type TModuleRootStore = {
  router: Pick<CoreRootStore["router"], "projectId">;
  moduleFilter: Pick<
    CoreRootStore["moduleFilter"],
    | "archivedModulesSearchQuery"
    | "getArchivedFiltersByProjectId"
    | "getDisplayFiltersByProjectId"
    | "getFiltersByProjectId"
    | "searchQuery"
  >;
  favorite: Pick<
    CoreRootStore["favorite"],
    "addFavorite" | "entityMap" | "removeFavoriteEntity" | "removeFavoriteFromStore"
  >;
  projectEstimate: Pick<CoreRootStore["projectEstimate"], "areEstimateEnabledByProjectId">;
};

export interface IModuleStore {
  plotType: Record<string, TModulePlotType>;
  // observables
  moduleMap: Record<string, IModule>;
  // computed
  projectModuleIds: string[];
  projectArchivedModuleIds: string[];
  // computed actions
  getFilteredModuleIds: (projectId: string) => string[];
  getFilteredArchivedModuleIds: (projectId: string) => string[];
  getModuleById: (moduleId: string) => IModule | null;
  getModuleNameById: (moduleId: string) => string | undefined;
  getProjectModuleDetails: (projectId: string) => IModule[];
  getProjectModuleIds: (projectId: string) => string[];
  getPlotTypeByModuleId: (moduleId: string) => TModulePlotType;
  // actions
  setPlotType: (moduleId: string, plotType: TModulePlotType) => void;
  // fetch
  updateModuleDistribution: (distributionUpdates: DistributionUpdates, moduleId: string) => void;
  fetchWorkspaceModules: (workspaceSlug: string) => Promise<IModule[]>;
  fetchModules: (workspaceSlug: string, projectId: string) => Promise<IModule[]>;
  fetchArchivedModules: (workspaceSlug: string, projectId: string) => Promise<IModule[]>;
  fetchArchivedModuleDetails: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<IModule>;
  fetchModuleDetails: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<IModule>;
  // crud
  createModule: (workspaceSlug: string, projectId: string, data: Partial<IModule>) => Promise<IModule>;
  updateModuleDetails: (
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    data: Partial<IModule>
  ) => Promise<IModule>;
  deleteModule: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<void>;
  createModuleLink: (
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    data: Partial<ILinkDetails>
  ) => Promise<ILinkDetails>;
  updateModuleLink: (
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    linkId: string,
    data: Partial<ILinkDetails>
  ) => Promise<ILinkDetails>;
  deleteModuleLink: (workspaceSlug: string, projectId: string, moduleId: string, linkId: string) => Promise<void>;
  // favorites
  addModuleToFavorites: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<void>;
  removeModuleFromFavorites: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<void>;
  // archive
  archiveModule: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<void>;
  restoreModule: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<void>;
}

export class ModulesStore implements IModuleStore {
  // observables
  moduleMap: Record<string, IModule> = {};
  plotType: Record<string, TModulePlotType> = {};
  // root store
  rootStore;
  // services
  projectService;
  moduleService;
  moduleArchiveService;

  constructor(_rootStore: TModuleRootStore) {
    makeObservable(this, {
      // observables
      moduleMap: observable,
      plotType: observable.ref,
      // computed
      projectModuleIds: computed,
      projectArchivedModuleIds: computed,
      // actions
      setPlotType: action,
      fetchWorkspaceModules: action,
      fetchModules: action,
      fetchArchivedModules: action,
      fetchArchivedModuleDetails: action,
      fetchModuleDetails: action,
      createModule: action,
      updateModuleDetails: action,
      deleteModule: action,
      createModuleLink: action,
      updateModuleLink: action,
      deleteModuleLink: action,
      addModuleToFavorites: action,
      removeModuleFromFavorites: action,
      archiveModule: action,
      restoreModule: action,
    });

    this.rootStore = _rootStore;

    // services
    this.projectService = new ProjectService();
    this.moduleService = new ModuleService();
    this.moduleArchiveService = new ModuleArchiveService();
  }

  /** All modules of a project, archived included. Every per-project list derives from this one pass. */
  private getAllProjectModules = computedFn((projectId: string): IModule[] =>
    Object.values(this.moduleMap).filter((m) => m.project_id === projectId)
  );

  // computed
  get projectModuleIds() {
    const projectId = this.rootStore.router.projectId;
    return projectId ? this.getProjectModuleIds(projectId) : [];
  }

  get projectArchivedModuleIds() {
    const projectId = this.rootStore.router.projectId;
    if (!projectId) return [];
    const archivedModules = this.getAllProjectModules(projectId).filter((m) => !!m.archived_at);
    return sortBy(archivedModules, [(m) => m.sort_order]).map((m) => m.id);
  }

  /** Non-archived module ids of a project that match the search, filters and display filters. */
  getFilteredModuleIds = computedFn((projectId: string) => {
    const displayFilters = this.rootStore.moduleFilter.getDisplayFiltersByProjectId(projectId);
    const filters = this.rootStore.moduleFilter.getFiltersByProjectId(projectId);
    const searchQuery = this.rootStore.moduleFilter.searchQuery.toLowerCase();
    const modules = this.getAllProjectModules(projectId).filter(
      (m) =>
        !m.archived_at &&
        m.name.toLowerCase().includes(searchQuery) &&
        shouldFilterModule(m, displayFilters ?? {}, filters ?? {})
    );
    return orderModules(modules, getModuleOrderBy(displayFilters)).map((m) => m.id);
  });

  /** Archived module ids of a project that match the archive search and filters. */
  getFilteredArchivedModuleIds = computedFn((projectId: string) => {
    const displayFilters = this.rootStore.moduleFilter.getDisplayFiltersByProjectId(projectId);
    const filters = this.rootStore.moduleFilter.getArchivedFiltersByProjectId(projectId);
    const searchQuery = this.rootStore.moduleFilter.archivedModulesSearchQuery.toLowerCase();
    const modules = this.getAllProjectModules(projectId).filter(
      (m) =>
        !!m.archived_at &&
        m.name.toLowerCase().includes(searchQuery) &&
        shouldFilterModule(m, displayFilters ?? {}, filters ?? {})
    );
    return orderModules(modules, displayFilters?.order_by).map((m) => m.id);
  });

  getModuleById = computedFn((moduleId: string): IModule | null => this.moduleMap[moduleId] ?? null);

  getModuleNameById = computedFn((moduleId: string): string | undefined => this.moduleMap[moduleId]?.name);

  /** Non-archived modules of a project, in manual order. Whether the list is complete is the query's concern. */
  getProjectModuleDetails = computedFn((projectId: string): IModule[] => {
    const projectModules = this.getAllProjectModules(projectId).filter((m) => !m.archived_at);
    return sortBy(projectModules, [(m) => m.sort_order]);
  });

  getProjectModuleIds = computedFn((projectId: string): string[] =>
    this.getProjectModuleDetails(projectId).map((m) => m.id)
  );

  /**
   * @description gets the plot type for the module store
   * @param {TModulePlotType} plotType
   */
  getPlotTypeByModuleId = (moduleId: string) => {
    const { projectId } = this.rootStore.router;

    return projectId && this.rootStore.projectEstimate.areEstimateEnabledByProjectId(projectId)
      ? this.plotType[moduleId] || "burndown"
      : "burndown";
  };

  /**
   * @description updates the plot type for the module store
   * @param {TModulePlotType} plotType
   */
  setPlotType = (moduleId: string, plotType: TModulePlotType) => {
    set(this.plotType, [moduleId], plotType);
  };

  /**
   * @description fetch all modules
   * @param workspaceSlug
   * @returns IModule[]
   */
  fetchWorkspaceModules = async (workspaceSlug: string) => {
    const response = await this.moduleService.getWorkspaceModules(workspaceSlug);
    runInAction(() => {
      response.forEach((module) => {
        set(this.moduleMap, [module.id], { ...this.moduleMap[module.id], ...module });
      });
    });
    return response;
  };

  /**
   * @description fetch all modules
   * @param workspaceSlug
   * @param projectId
   * @returns IModule[]
   */
  fetchModules = async (workspaceSlug: string, projectId: string) => {
    const response = await this.moduleService.getModules(workspaceSlug, projectId);
    runInAction(() => {
      response.forEach((module) => {
        set(this.moduleMap, [module.id], { ...this.moduleMap[module.id], ...module });
      });
    });
    return response;
  };

  /**
   * @description fetch all archived modules
   * @param workspaceSlug
   * @param projectId
   * @returns IModule[]
   */
  fetchArchivedModules = async (workspaceSlug: string, projectId: string) => {
    const response = await this.moduleArchiveService.getArchivedModules(workspaceSlug, projectId);
    runInAction(() => {
      response.forEach((module) => {
        set(this.moduleMap, [module.id], { ...this.moduleMap[module.id], ...module });
      });
    });
    return response;
  };

  /**
   * @description fetch module details
   * @param workspaceSlug
   * @param projectId
   * @param moduleId
   * @returns IModule
   */
  fetchArchivedModuleDetails = async (workspaceSlug: string, projectId: string, moduleId: string) =>
    await this.moduleArchiveService.getArchivedModuleDetails(workspaceSlug, projectId, moduleId).then((response) => {
      runInAction(() => {
        set(this.moduleMap, [response.id], { ...this.moduleMap?.[response.id], ...response });
      });
      return response;
    });

  /**
   * This method updates the module's stats locally without fetching the updated stats from backend
   * @param distributionUpdates
   * @param moduleId
   * @returns
   */
  updateModuleDistribution = (distributionUpdates: DistributionUpdates, moduleId: string) => {
    const moduleInfo = this.moduleMap[moduleId];

    if (!moduleInfo) return;

    runInAction(() => {
      updateDistribution(moduleInfo, distributionUpdates);
    });
  };

  /**
   * @description fetch module details
   * @param workspaceSlug
   * @param projectId
   * @param moduleId
   * @returns IModule
   */
  fetchModuleDetails = async (workspaceSlug: string, projectId: string, moduleId: string) =>
    await this.moduleService.getModuleDetails(workspaceSlug, projectId, moduleId).then((response) => {
      runInAction(() => {
        set(this.moduleMap, [moduleId], response);
      });
      return response;
    });

  /**
   * @description creates a new module
   * @param workspaceSlug
   * @param projectId
   * @param data
   * @returns IModule
   */
  createModule = async (workspaceSlug: string, projectId: string, data: Partial<IModule>) =>
    await this.moduleService.createModule(workspaceSlug, projectId, data).then((response) => {
      runInAction(() => {
        set(this.moduleMap, [response?.id], response);
      });
      return response;
    });

  /**
   * @description updates module details
   * @param workspaceSlug
   * @param projectId
   * @param moduleId
   * @param data
   * @returns IModule
   */
  updateModuleDetails = async (workspaceSlug: string, projectId: string, moduleId: string, data: Partial<IModule>) => {
    const originalModuleDetails = this.getModuleById(moduleId);
    try {
      runInAction(() => {
        set(this.moduleMap, [moduleId], { ...originalModuleDetails, ...data });
      });
      const response = await this.moduleService.patchModule(workspaceSlug, projectId, moduleId, data);
      return response;
    } catch (error) {
      console.error("Failed to update module in module store", error);
      runInAction(() => {
        set(this.moduleMap, [moduleId], { ...originalModuleDetails });
      });
      throw error;
    }
  };

  /**
   * @description deletes a module
   * @param workspaceSlug
   * @param projectId
   * @param moduleId
   */
  deleteModule = async (workspaceSlug: string, projectId: string, moduleId: string) => {
    const moduleDetails = this.getModuleById(moduleId);
    if (!moduleDetails) return;
    await this.moduleService.deleteModule(workspaceSlug, projectId, moduleId);
    runInAction(() => {
      delete this.moduleMap[moduleId];
      if (this.rootStore.favorite.entityMap[moduleId]) this.rootStore.favorite.removeFavoriteFromStore(moduleId);
    });
  };

  /**
   * @description creates a new module link
   * @param workspaceSlug
   * @param projectId
   * @param moduleId
   * @param data
   * @returns ILinkDetails
   */
  createModuleLink = async (
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    data: Partial<ILinkDetails>
  ) => {
    const moduleLink = await this.moduleService.createModuleLink(workspaceSlug, projectId, moduleId, data);
    runInAction(() => {
      const moduleDetails = this.moduleMap[moduleId];
      if (moduleDetails) moduleDetails.link_module = [...(moduleDetails.link_module ?? []), moduleLink];
    });
    return moduleLink;
  };

  /**
   * @description updates module link details
   * @param workspaceSlug
   * @param projectId
   * @param moduleId
   * @param linkId
   * @param data
   * @returns ILinkDetails
   */
  updateModuleLink = async (
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    linkId: string,
    data: Partial<ILinkDetails>
  ) => {
    const originalModuleDetails = this.getModuleById(moduleId);
    try {
      const linkModules = originalModuleDetails?.link_module?.map((link) =>
        link.id === linkId ? { ...link, ...data } : link
      );
      runInAction(() => {
        set(this.moduleMap, [moduleId, "link_module"], linkModules);
      });
      const response = await this.moduleService.updateModuleLink(workspaceSlug, projectId, moduleId, linkId, data);
      return response;
    } catch (error) {
      console.error("Failed to update module link in module store", error);
      runInAction(() => {
        set(this.moduleMap, [moduleId, "link_module"], originalModuleDetails?.link_module);
      });
      throw error;
    }
  };

  /**
   * @description deletes a module link
   * @param workspaceSlug
   * @param projectId
   * @param moduleId
   * @param linkId
   */
  deleteModuleLink = async (workspaceSlug: string, projectId: string, moduleId: string, linkId: string) => {
    await this.moduleService.deleteModuleLink(workspaceSlug, projectId, moduleId, linkId);
    runInAction(() => {
      const moduleDetails = this.moduleMap[moduleId];
      if (moduleDetails?.link_module)
        moduleDetails.link_module = moduleDetails.link_module.filter((link) => link.id !== linkId);
    });
  };

  /**
   * @description adds a module to favorites
   * @param workspaceSlug
   * @param projectId
   * @param moduleId
   * @returns
   */
  addModuleToFavorites = async (workspaceSlug: string, projectId: string, moduleId: string) => {
    try {
      const moduleDetails = this.getModuleById(moduleId);
      if (moduleDetails?.is_favorite) return;
      runInAction(() => {
        set(this.moduleMap, [moduleId, "is_favorite"], true);
      });
      await this.rootStore.favorite.addFavorite(workspaceSlug.toString(), {
        entity_type: "module",
        entity_identifier: moduleId,
        project_id: projectId,
        entity_data: { name: this.moduleMap[moduleId].name || "" },
      });
    } catch (error) {
      console.error("Failed to add module to favorites in module store", error);
      runInAction(() => {
        set(this.moduleMap, [moduleId, "is_favorite"], false);
      });
    }
  };

  /**
   * @description removes a module from favorites
   * @param workspaceSlug
   * @param projectId
   * @param moduleId
   * @returns
   */
  removeModuleFromFavorites = async (workspaceSlug: string, projectId: string, moduleId: string) => {
    try {
      const moduleDetails = this.getModuleById(moduleId);
      if (!moduleDetails?.is_favorite) return;
      runInAction(() => {
        set(this.moduleMap, [moduleId, "is_favorite"], false);
      });
      await this.rootStore.favorite.removeFavoriteEntity(workspaceSlug, moduleId);
    } catch (error) {
      console.error("Failed to remove module from favorites in module store", error);
      runInAction(() => {
        set(this.moduleMap, [moduleId, "is_favorite"], true);
      });
    }
  };

  /**
   * @description archives a module
   * @param workspaceSlug
   * @param projectId
   * @param moduleId
   * @returns
   */
  archiveModule = async (workspaceSlug: string, projectId: string, moduleId: string) => {
    const moduleDetails = this.getModuleById(moduleId);
    if (moduleDetails?.archived_at) return;
    try {
      const response = await this.moduleArchiveService.archiveModule(workspaceSlug, projectId, moduleId);
      runInAction(() => {
        set(this.moduleMap, [moduleId, "archived_at"], response.archived_at);
        if (this.rootStore.favorite.entityMap[moduleId]) this.rootStore.favorite.removeFavoriteFromStore(moduleId);
      });
    } catch (error) {
      console.error("Failed to archive module in module store", error);
    }
  };

  /**
   * @description restores a module
   * @param workspaceSlug
   * @param projectId
   * @param moduleId
   * @returns
   */
  restoreModule = async (workspaceSlug: string, projectId: string, moduleId: string) => {
    const moduleDetails = this.getModuleById(moduleId);
    if (!moduleDetails?.archived_at) return;
    try {
      await this.moduleArchiveService.restoreModule(workspaceSlug, projectId, moduleId);
      runInAction(() => {
        set(this.moduleMap, [moduleId, "archived_at"], null);
      });
    } catch (error) {
      console.error("Failed to restore module in module store", error);
    }
  };
}
