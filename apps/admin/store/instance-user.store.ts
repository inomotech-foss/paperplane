/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set, unset } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
// plane imports
import { InstanceUserService } from "@plane/services";
import type {
  IInstanceUser,
  TInstanceUserDeactivation,
  TInstanceUserListParams,
  TInstanceUserMergeRequest,
  TInstanceUserMergeResult,
  TLoader,
  TPaginationInfo,
} from "@plane/types";
// root store
import type { RootStore } from "@/store/root.store";

export type TInstanceUserFilters = Pick<TInstanceUserListParams, "search" | "include_deleted">;

export interface IInstanceUserStore {
  // observables
  loader: TLoader;
  users: Record<string, IInstanceUser>;
  paginationInfo: TPaginationInfo | undefined;
  filters: TInstanceUserFilters;
  // computed
  userIds: string[];
  // helpers
  getUserById: (userId: string) => IInstanceUser | undefined;
  // fetch actions
  fetchUsers: (filters?: TInstanceUserFilters) => Promise<IInstanceUser[]>;
  fetchNextUsers: () => Promise<IInstanceUser[]>;
  // lifecycle actions
  deactivateUser: (userId: string) => Promise<TInstanceUserDeactivation>;
  reactivateUser: (userId: string) => Promise<IInstanceUser>;
  deleteUser: (userId: string) => Promise<void>;
  previewMerge: (survivorId: string, data: TInstanceUserMergeRequest) => Promise<TInstanceUserMergeResult>;
  mergeUsers: (survivorId: string, data: TInstanceUserMergeRequest) => Promise<TInstanceUserMergeResult>;
}

export class InstanceUserStore implements IInstanceUserStore {
  // observables
  loader: TLoader = "init-loader";
  users: Record<string, IInstanceUser> = {};
  paginationInfo: TPaginationInfo | undefined = undefined;
  filters: TInstanceUserFilters = {};
  // services
  instanceUserService;

  constructor(private store: RootStore) {
    makeObservable(this, {
      loader: observable,
      users: observable,
      paginationInfo: observable,
      filters: observable,
      userIds: computed,
      fetchUsers: action,
      fetchNextUsers: action,
      deactivateUser: action,
      reactivateUser: action,
      deleteUser: action,
      mergeUsers: action,
    });
    this.instanceUserService = new InstanceUserService();
  }

  get userIds() {
    return Object.keys(this.users);
  }

  getUserById = (userId: string) => this.users[userId];

  /** Writes after an await need their own action scope. */
  private markLoaded = () => {
    runInAction(() => {
      this.loader = "loaded";
    });
  };

  private storePage = (page: { results: IInstanceUser[] } & TPaginationInfo, replace: boolean) => {
    runInAction(() => {
      const { results, ...paginationInfo } = page;
      if (replace) this.users = {};
      results.forEach((user) => set(this.users, [user.id], user));
      this.paginationInfo = paginationInfo;
    });
  };

  fetchUsers = async (filters: TInstanceUserFilters = this.filters): Promise<IInstanceUser[]> => {
    try {
      this.loader = this.userIds.length > 0 ? "mutation" : "init-loader";
      this.filters = filters;
      const page = await this.instanceUserService.list(filters);
      this.storePage(page, true);
      return page.results;
    } catch (error) {
      console.error("Error fetching users", error);
      throw error;
    } finally {
      this.markLoaded();
    }
  };

  fetchNextUsers = async (): Promise<IInstanceUser[]> => {
    if (!this.paginationInfo || this.paginationInfo.next_page_results === false) return [];
    try {
      this.loader = "pagination";
      const page = await this.instanceUserService.list({ ...this.filters, cursor: this.paginationInfo.next_cursor });
      this.storePage(page, false);
      return page.results;
    } catch (error) {
      console.error("Error fetching next users", error);
      throw error;
    } finally {
      this.markLoaded();
    }
  };

  deactivateUser = async (userId: string): Promise<TInstanceUserDeactivation> => {
    const result = await this.instanceUserService.deactivate(userId);
    runInAction(() => {
      set(this.users, [userId], result.user);
    });
    return result;
  };

  reactivateUser = async (userId: string): Promise<IInstanceUser> => {
    const { user } = await this.instanceUserService.reactivate(userId);
    runInAction(() => {
      set(this.users, [userId], user);
    });
    return user;
  };

  deleteUser = async (userId: string): Promise<void> => {
    await this.instanceUserService.destroy(userId);
    runInAction(() => {
      if (this.filters.include_deleted) return;
      unset(this.users, [userId]);
    });
    if (this.filters.include_deleted) await this.fetchUsers();
  };

  previewMerge = (survivorId: string, data: TInstanceUserMergeRequest): Promise<TInstanceUserMergeResult> =>
    this.instanceUserService.mergePreview(survivorId, data);

  mergeUsers = async (survivorId: string, data: TInstanceUserMergeRequest): Promise<TInstanceUserMergeResult> => {
    const result = await this.instanceUserService.merge(survivorId, data);
    // Both rows changed, the source is gone and the survivor may carry a new email.
    await this.fetchUsers();
    return result;
  };
}
