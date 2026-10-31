/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, computed, makeObservable, observable, runInAction } from "mobx";
// plane imports
import { isApiError } from "@plane/services";
import type { ActorDetail } from "@plane/types";
// services
import { UserService } from "@/services/user.service";
import type { TCurrentUser } from "@/services/user.service";
// store types
import type { IProfileStore } from "@/store/profile.store";
import { ProfileStore } from "@/store/profile.store";
// store
import type { RootStore } from "@/store/root.store";

type TUserErrorStatus = {
  status: string;
  message: string;
};

export interface IUserStore {
  // observables
  isAuthenticated: boolean;
  isInitializing: boolean;
  error: TUserErrorStatus | undefined;
  data: TCurrentUser | undefined;
  // store observables
  profile: IProfileStore;
  // computed
  currentActor: ActorDetail;
  // actions
  fetchCurrentUser: () => Promise<TCurrentUser | undefined>;
  reset: () => void;
  signOut: () => Promise<void>;
}

export class UserStore implements IUserStore {
  // observables
  isAuthenticated: boolean = false;
  isInitializing: boolean = true;
  error: TUserErrorStatus | undefined = undefined;
  data: TCurrentUser | undefined = undefined;
  // store observables
  profile: IProfileStore;
  // service
  userService: UserService;

  constructor(private store: RootStore) {
    // stores
    this.profile = new ProfileStore(store);
    // service
    this.userService = new UserService();
    // observables
    makeObservable(this, {
      // observables
      isAuthenticated: observable.ref,
      isInitializing: observable.ref,
      error: observable,
      // model observables
      data: observable,
      profile: observable,
      // computed
      currentActor: computed,
      // actions
      fetchCurrentUser: action,
      reset: action,
      signOut: action,
    });
  }

  // computed
  get currentActor(): ActorDetail {
    return {
      id: this.data?.id,
      first_name: this.data?.first_name,
      last_name: this.data?.last_name,
      display_name: this.data?.display_name,
      avatar_url: this.data?.avatar_url || undefined,
      is_bot: false,
    };
  }

  // actions
  /**
   * @description fetches the current user
   * @returns {Promise<TCurrentUser>}
   */
  fetchCurrentUser = async (): Promise<TCurrentUser> => {
    try {
      runInAction(() => {
        if (this.data === undefined && !this.error) this.isInitializing = true;
        this.error = undefined;
      });
      const user = await this.userService.me();
      if (user && user?.id) {
        await this.profile.fetchUserProfile();
        runInAction(() => {
          this.data = user;
          this.isInitializing = false;
          this.isAuthenticated = true;
        });
      } else
        runInAction(() => {
          this.data = user;
          this.isInitializing = false;
          this.isAuthenticated = false;
        });
      return user;
    } catch (error) {
      runInAction(() => {
        this.isInitializing = false;
        this.isAuthenticated = false;
        this.error = {
          status: "user-fetch-error",
          message: "Failed to fetch current user",
        };
        if (isApiError(error) && error.status === 401) {
          this.data = undefined;
        }
      });
      throw error;
    }
  };

  /**
   * @description resets the user store
   * @returns {void}
   */
  reset = (): void => {
    runInAction(() => {
      this.isAuthenticated = false;
      this.isInitializing = false;
      this.error = undefined;
      this.data = undefined;
      this.profile = new ProfileStore(this.store);
    });
  };

  /**
   * @description signs out the current user
   * @returns {Promise<void>}
   */
  signOut = async (): Promise<void> => {
    this.store.reset();
  };
}
