/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set, unset } from "lodash-es";
import { action, observable, runInAction, makeObservable, computed } from "mobx";
// plane imports
import { InstanceWorkspaceService } from "@plane/services";
import type { TInstanceWorkspace, TInstanceWorkspaceCreateBody } from "@plane/services";
import type { TLoader, TPaginationInfo } from "@plane/types";
// root store
import type { RootStore } from "@/store/root.store";

export interface IWorkspaceStore {
  // observables
  loader: TLoader;
  workspaces: Record<string, TInstanceWorkspace>;
  paginationInfo: TPaginationInfo | undefined;
  // computed
  workspaceIds: string[];
  // helper actions
  hydrate: (data: Record<string, TInstanceWorkspace> | undefined) => void;
  getWorkspaceById: (workspaceId: string) => TInstanceWorkspace | undefined;
  // fetch actions
  fetchWorkspaces: () => Promise<TInstanceWorkspace[]>;
  fetchNextWorkspaces: () => Promise<TInstanceWorkspace[]>;
  // curd actions
  createWorkspace: (data: TInstanceWorkspaceCreateBody) => Promise<TInstanceWorkspace>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  transferOwner: (workspaceId: string, ownerId: string) => Promise<TInstanceWorkspace>;
}

export class WorkspaceStore implements IWorkspaceStore {
  // observables
  loader: TLoader = "init-loader";
  workspaces: Record<string, TInstanceWorkspace> = {};
  paginationInfo: TPaginationInfo | undefined = undefined;
  // services
  instanceWorkspaceService;

  constructor(private store: RootStore) {
    makeObservable(this, {
      // observables
      loader: observable,
      workspaces: observable,
      paginationInfo: observable,
      // computed
      workspaceIds: computed,
      // helper actions
      hydrate: action,
      getWorkspaceById: action,
      // fetch actions
      fetchWorkspaces: action,
      fetchNextWorkspaces: action,
      // curd actions
      createWorkspace: action,
      deleteWorkspace: action,
      transferOwner: action,
    });
    this.instanceWorkspaceService = new InstanceWorkspaceService();
  }

  // computed
  get workspaceIds() {
    return Object.keys(this.workspaces);
  }

  // helper actions
  /**
   * @description Hydrates the workspaces
   * @param data - Record<string, TInstanceWorkspace>
   */
  hydrate = (data: Record<string, TInstanceWorkspace> | undefined) => {
    if (data) this.workspaces = data;
  };

  /**
   * @description Gets a workspace by id
   * @param workspaceId - string
   * @returns TInstanceWorkspace | undefined
   */
  getWorkspaceById = (workspaceId: string) => this.workspaces[workspaceId];

  // fetch actions
  /**
   * @description Fetches all workspaces
   * @returns Promise<>
   */
  fetchWorkspaces = async (): Promise<TInstanceWorkspace[]> => {
    try {
      if (this.workspaceIds.length > 0) {
        this.loader = "mutation";
      } else {
        this.loader = "init-loader";
      }
      const paginatedWorkspaceData = await this.instanceWorkspaceService.list();
      runInAction(() => {
        const { results, ...paginationInfo } = paginatedWorkspaceData;
        results.forEach((workspace: TInstanceWorkspace) => {
          set(this.workspaces, [workspace.id], workspace);
        });
        set(this, "paginationInfo", paginationInfo);
      });
      return paginatedWorkspaceData.results;
    } catch (error) {
      console.error("Error fetching workspaces", error);
      throw error;
    } finally {
      this.loader = "loaded";
    }
  };

  /**
   * @description Fetches the next page of workspaces
   * @returns Promise<TInstanceWorkspace[]>
   */
  fetchNextWorkspaces = async (): Promise<TInstanceWorkspace[]> => {
    if (!this.paginationInfo || this.paginationInfo.next_page_results === false) return [];
    try {
      this.loader = "pagination";
      const paginatedWorkspaceData = await this.instanceWorkspaceService.list(this.paginationInfo.next_cursor);
      runInAction(() => {
        const { results, ...paginationInfo } = paginatedWorkspaceData;
        results.forEach((workspace: TInstanceWorkspace) => {
          set(this.workspaces, [workspace.id], workspace);
        });
        set(this, "paginationInfo", paginationInfo);
      });
      return paginatedWorkspaceData.results;
    } catch (error) {
      console.error("Error fetching next workspaces", error);
      throw error;
    } finally {
      this.loader = "loaded";
    }
  };

  // curd actions
  /**
   * @description Creates a new workspace
   * @param data - TInstanceWorkspaceCreateBody
   * @returns Promise<TInstanceWorkspace>
   */
  createWorkspace = async (data: TInstanceWorkspaceCreateBody): Promise<TInstanceWorkspace> => {
    try {
      this.loader = "mutation";
      const workspace = await this.instanceWorkspaceService.create(data);
      runInAction(() => {
        set(this.workspaces, [workspace.id], workspace);
      });
      return workspace;
    } catch (error) {
      console.error("Error creating workspace", error);
      throw error;
    } finally {
      this.loader = "loaded";
    }
  };

  deleteWorkspace = async (workspaceId: string): Promise<void> => {
    await this.instanceWorkspaceService.destroy(workspaceId);
    runInAction(() => {
      unset(this.workspaces, [workspaceId]);
    });
  };

  transferOwner = async (workspaceId: string, ownerId: string): Promise<TInstanceWorkspace> => {
    const workspace = await this.instanceWorkspaceService.transferOwner(workspaceId, ownerId);
    runInAction(() => {
      set(this.workspaces, [workspaceId], workspace);
    });
    return workspace;
  };
}
