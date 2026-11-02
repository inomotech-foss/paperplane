/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { observable, action, makeObservable, runInAction, computed } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { IProjectView, TViewFilters } from "@plane/types";
// constants
// helpers
import { getValidatedViewFilters, getViewName, orderViews, shouldFilterView } from "@plane/utils";
// services
import { ViewService } from "@/services/view.service";
// store
import type { CoreRootStore } from "./root.store";

export interface IProjectViewStore {
  // observables
  viewMap: Record<string, IProjectView>;
  filters: TViewFilters;
  // computed
  projectViewIds: string[];
  // computed actions
  getProjectViews: (projectId: string) => IProjectView[];
  getFilteredProjectViews: (projectId: string) => IProjectView[];
  getViewById: (viewId: string) => IProjectView;
  // fetch actions
  fetchViews: (workspaceSlug: string, projectId: string) => Promise<IProjectView[]>;
  fetchViewDetails: (workspaceSlug: string, projectId: string, viewId: string) => Promise<IProjectView>;
  // CRUD actions
  createView: (workspaceSlug: string, projectId: string, data: Partial<IProjectView>) => Promise<IProjectView>;
  updateView: (
    workspaceSlug: string,
    projectId: string,
    viewId: string,
    data: Partial<IProjectView>
  ) => Promise<IProjectView>;
  deleteView: (workspaceSlug: string, projectId: string, viewId: string) => Promise<void>;
  updateFilters: <T extends keyof TViewFilters>(filterKey: T, filterValue: TViewFilters[T]) => void;
  clearAllFilters: () => void;
  // favorites actions
  addViewToFavorites: (workspaceSlug: string, projectId: string, viewId: string) => Promise<void>;
  removeViewFromFavorites: (workspaceSlug: string, projectId: string, viewId: string) => Promise<void>;
}

export class ProjectViewStore implements IProjectViewStore {
  // observables
  viewMap: Record<string, IProjectView> = {};
  filters: TViewFilters = { searchQuery: "", sortBy: "desc", sortKey: "updated_at" };
  // root store
  rootStore: CoreRootStore;
  // services
  viewService: ViewService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      // observables
      viewMap: observable,
      filters: observable,
      // computed
      projectViewIds: computed,
      // fetch actions
      fetchViews: action,
      fetchViewDetails: action,
      // CRUD actions
      createView: action,
      updateView: action,
      deleteView: action,
      // actions
      updateFilters: action,
      clearAllFilters: action,
      // favorites actions
      addViewToFavorites: action,
      removeViewFromFavorites: action,
    });
    // root store
    this.rootStore = _rootStore;
    // services
    this.viewService = new ViewService();

    this.createView = this.createView.bind(this);
    this.updateView = this.updateView.bind(this);
  }

  /**
   * Returns array of view ids for current project
   */
  get projectViewIds() {
    const projectId = this.rootStore.router.projectId;
    if (!projectId) return [];
    const viewIds = Object.keys(this.viewMap ?? {})?.filter((viewId) => this.viewMap?.[viewId]?.project === projectId);
    return viewIds;
  }

  getProjectViews = computedFn((projectId: string) => {
    const ViewsList = Object.values(this.viewMap ?? {});
    // helps to filter views based on the projectId
    const filteredViews = ViewsList.filter((view) => view?.project === projectId);
    return orderViews(filteredViews, this.filters.sortKey, this.filters.sortBy);
  });
  /**
   * returns viewsIds of issues
   */
  getFilteredProjectViews = computedFn((projectId: string) => {
    const ViewsList = Object.values(this.viewMap ?? {});
    // helps to filter views based on the projectId, searchQuery and filters
    const filteredViews = ViewsList.filter(
      (view) =>
        view?.project === projectId &&
        getViewName(view.name).toLowerCase().includes(this.filters.searchQuery.toLowerCase()) &&
        shouldFilterView(view, this.filters.filters)
    );
    return orderViews(filteredViews, this.filters.sortKey, this.filters.sortBy);
  });

  /**
   * Returns view details by id
   */
  getViewById = computedFn((viewId: string) => this.viewMap?.[viewId] ?? null);

  /**
   * Updates the filter
   * @param filterKey
   * @param filterValue
   */
  updateFilters = <T extends keyof TViewFilters>(filterKey: T, filterValue: TViewFilters[T]) => {
    runInAction(() => {
      set(this.filters, [filterKey], filterValue);
    });
  };

  /**
   * @description clears all the filters
   */
  clearAllFilters = () =>
    runInAction(() => {
      set(this.filters, ["filters"], {});
    });

  /**
   * Fetches views for current project
   * @param workspaceSlug
   * @param projectId
   * @returns Promise<IProjectView[]>
   */
  fetchViews = async (workspaceSlug: string, projectId: string) => {
    const response = await this.viewService.getViews(workspaceSlug, projectId);
    runInAction(() => {
      response.forEach((view) => {
        set(this.viewMap, [view.id], view);
      });
    });
    return response;
  };

  /**
   * Fetches view details for a specific view
   * @param workspaceSlug
   * @param projectId
   * @param viewId
   * @returns Promise<IProjectView>
   */
  fetchViewDetails = async (workspaceSlug: string, projectId: string, viewId: string): Promise<IProjectView> =>
    await this.viewService.getViewDetails(workspaceSlug, projectId, viewId).then((response) => {
      runInAction(() => {
        set(this.viewMap, [viewId], response);
      });
      return response;
    });

  /**
   * Creates a new view for a specific project and adds it to the store
   * @param workspaceSlug
   * @param projectId
   * @param data
   * @returns Promise<IProjectView>
   */
  async createView(workspaceSlug: string, projectId: string, data: Partial<IProjectView>): Promise<IProjectView> {
    const response = await this.viewService.createView(workspaceSlug, projectId, getValidatedViewFilters(data));

    runInAction(() => {
      set(this.viewMap, [response.id], response);
    });

    return response;
  }

  /**
   * Updates a view details of specific view and updates it in the store
   * @param workspaceSlug
   * @param projectId
   * @param viewId
   * @param data
   * @returns Promise<IProjectView>
   */
  async updateView(
    workspaceSlug: string,
    projectId: string,
    viewId: string,
    data: Partial<IProjectView>
  ): Promise<IProjectView> {
    const currentView = this.getViewById(viewId);

    runInAction(() => {
      set(this.viewMap, [viewId], { ...currentView, ...data });
    });

    const response = await this.viewService.patchView(workspaceSlug, projectId, viewId, data);

    return response;
  }

  /**
   * Deletes a view and removes it from the viewMap object
   * @param workspaceSlug
   * @param projectId
   * @param viewId
   * @returns
   */
  deleteView = async (workspaceSlug: string, projectId: string, viewId: string): Promise<void> => {
    await this.viewService.deleteView(workspaceSlug, projectId, viewId).then(() => {
      runInAction(() => {
        delete this.viewMap[viewId];
        if (this.rootStore.favorite.entityMap[viewId]) this.rootStore.favorite.removeFavoriteFromStore(viewId);
      });
    });
  };

  /**
   * Adds a view to favorites
   * @param workspaceSlug
   * @param projectId
   * @param viewId
   * @returns
   */
  addViewToFavorites = async (workspaceSlug: string, projectId: string, viewId: string) => {
    try {
      const currentView = this.getViewById(viewId);
      if (currentView?.is_favorite) return;
      runInAction(() => {
        set(this.viewMap, [viewId, "is_favorite"], true);
      });
      await this.rootStore.favorite.addFavorite(workspaceSlug.toString(), {
        entity_type: "view",
        entity_identifier: viewId,
        project_id: projectId,
        entity_data: { name: this.viewMap[viewId].name || "" },
      });
    } catch (error) {
      console.error("Failed to add view to favorites in view store", error);
      runInAction(() => {
        set(this.viewMap, [viewId, "is_favorite"], false);
      });
    }
  };

  /**
   * Removes a view from favorites
   * @param workspaceSlug
   * @param projectId
   * @param viewId
   * @returns
   */
  removeViewFromFavorites = async (workspaceSlug: string, projectId: string, viewId: string) => {
    try {
      const currentView = this.getViewById(viewId);
      if (!currentView?.is_favorite) return;
      runInAction(() => {
        set(this.viewMap, [viewId, "is_favorite"], false);
      });
      await this.rootStore.favorite.removeFavoriteEntity(workspaceSlug, viewId);
    } catch (error) {
      console.error("Failed to remove view from favorites in view store", error);
      runInAction(() => {
        set(this.viewMap, [viewId, "is_favorite"], true);
      });
    }
  };
}
