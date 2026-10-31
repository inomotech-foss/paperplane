/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, makeObservable, observable, runInAction } from "mobx";
// services
import { UserService } from "@/services/user.service";
import type { TUserProfile } from "@/services/user.service";
// store
import type { RootStore } from "@/store/root.store";

type TError = {
  status: string;
  message: string;
};

export interface IProfileStore {
  // observables
  isLoading: boolean;
  error: TError | undefined;
  data: TUserProfile | undefined;
  // actions
  fetchUserProfile: () => Promise<TUserProfile | undefined>;
}

export class ProfileStore implements IProfileStore {
  isLoading: boolean = false;
  error: TError | undefined = undefined;
  data: TUserProfile | undefined = undefined;

  // services
  userService: UserService;

  constructor(public store: RootStore) {
    makeObservable(this, {
      // observables
      isLoading: observable.ref,
      error: observable,
      data: observable,
      // actions
      fetchUserProfile: action,
    });
    // services
    this.userService = new UserService();
  }

  // actions
  /**
   * @description fetches user profile information
   * @returns {Promise<TUserProfile | undefined>}
   */
  fetchUserProfile = async () => {
    try {
      runInAction(() => {
        this.isLoading = true;
        this.error = undefined;
      });
      const userProfile = await this.userService.profile();
      runInAction(() => {
        this.isLoading = false;
        this.data = userProfile;
      });
      return userProfile;
    } catch (_error) {
      runInAction(() => {
        this.isLoading = false;
        this.error = {
          status: "user-profile-fetch-error",
          message: "Failed to fetch user profile",
        };
      });
    }
  };
}
