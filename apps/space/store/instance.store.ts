/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observable, action, makeObservable, runInAction } from "mobx";
// services
import { InstanceService } from "@/services/instance.service";
import type { TInstanceInfoResponse } from "@/services/instance.service";
// store
import type { RootStore } from "@/store/root.store";

type TInstanceInfo = Extract<TInstanceInfoResponse, { instance: unknown }>;
type TInstance = TInstanceInfo["instance"];
type TInstanceConfig = TInstanceInfo["config"];

type TError = {
  status: string;
  message: string;
  data?: {
    is_activated: boolean;
    is_setup_done: boolean;
  };
};

export interface IInstanceStore {
  // observables
  isLoading: boolean;
  instance: TInstance | undefined;
  config: TInstanceConfig | undefined;
  error: TError | undefined;
  // action
  fetchInstanceInfo: () => Promise<void>;
}

export class InstanceStore implements IInstanceStore {
  isLoading: boolean = true;
  instance: TInstance | undefined = undefined;
  config: TInstanceConfig | undefined = undefined;
  error: TError | undefined = undefined;
  // services
  instanceService;

  constructor(private store: RootStore) {
    makeObservable(this, {
      // observable
      isLoading: observable.ref,
      instance: observable,
      config: observable,
      error: observable,
      // actions
      fetchInstanceInfo: action,
    });
    // services
    this.instanceService = new InstanceService();
  }

  /**
   * @description fetching instance information
   */
  fetchInstanceInfo = async () => {
    try {
      this.isLoading = true;
      this.error = undefined;
      const instanceInfo = await this.instanceService.info();
      runInAction(() => {
        this.isLoading = false;
        if ("instance" in instanceInfo) {
          this.instance = instanceInfo.instance;
          this.config = instanceInfo.config;
        } else {
          this.error = { status: "error", message: "Instance is not registered", data: instanceInfo };
        }
      });
    } catch (_error) {
      runInAction(() => {
        this.isLoading = false;
        this.error = {
          status: "error",
          message: "Failed to fetch instance info",
        };
      });
    }
  };
}
