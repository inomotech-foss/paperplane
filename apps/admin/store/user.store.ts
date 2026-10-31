/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, observable, runInAction, makeObservable } from "mobx";
// plane internal packages
import type { TUserStatus } from "@plane/constants";
import { EUserStatus } from "@plane/constants";
import { AuthService, UserService, isApiError } from "@plane/services";
import type { TInstanceAdminMe } from "@plane/services";
// root store
import type { RootStore } from "@/store/root.store";

export interface IUserStore {
  // observables
  isLoading: boolean;
  userStatus: TUserStatus | undefined;
  isUserLoggedIn: boolean | undefined;
  currentUser: TInstanceAdminMe | undefined;
  // fetch actions
  hydrate: (data: TInstanceAdminMe | undefined) => void;
  fetchCurrentUser: () => Promise<TInstanceAdminMe>;
  reset: () => void;
  signOut: () => void;
}

export class UserStore implements IUserStore {
  // observables
  isLoading: boolean = true;
  userStatus: TUserStatus | undefined = undefined;
  isUserLoggedIn: boolean | undefined = undefined;
  currentUser: TInstanceAdminMe | undefined = undefined;
  // services
  userService;
  authService;

  constructor(private store: RootStore) {
    makeObservable(this, {
      // observables
      isLoading: observable.ref,
      userStatus: observable,
      isUserLoggedIn: observable.ref,
      currentUser: observable,
      // action
      fetchCurrentUser: action,
      reset: action,
      signOut: action,
    });
    this.userService = new UserService();
    this.authService = new AuthService();
  }

  hydrate = (data: TInstanceAdminMe | undefined) => {
    if (data) this.currentUser = data;
  };

  /**
   * @description Fetches the current user
   * @returns Promise<TInstanceAdminMe>
   */
  fetchCurrentUser = async () => {
    try {
      if (this.currentUser === undefined) this.isLoading = true;
      const currentUser = await this.userService.adminDetails();
      if (currentUser) {
        await this.store.instance.fetchInstanceAdmins();
        runInAction(() => {
          this.isUserLoggedIn = true;
          this.currentUser = currentUser;
          this.isLoading = false;
        });
      } else {
        runInAction(() => {
          this.isUserLoggedIn = false;
          this.currentUser = undefined;
          this.isLoading = false;
        });
      }
      return currentUser;
    } catch (error) {
      this.isLoading = false;
      this.isUserLoggedIn = false;
      const message = isApiError(error) ? (error.detail ?? error.error ?? "") : "";
      if (isApiError(error) && error.status === 403)
        this.userStatus = {
          status: EUserStatus.AUTHENTICATION_NOT_DONE,
          message,
        };
      else
        this.userStatus = {
          status: EUserStatus.ERROR,
          message,
        };
      throw error;
    }
  };

  reset = async () => {
    this.isUserLoggedIn = false;
    this.currentUser = undefined;
    this.isLoading = false;
    this.userStatus = undefined;
  };

  signOut = async () => {
    this.store.resetOnSignOut();
  };
}
