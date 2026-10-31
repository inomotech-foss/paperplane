/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { clone } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
// plane imports
// helpers
import { sortStates, toPublicState } from "@/helpers/state.helper";
import { PublicProjectService } from "@/services/project.service";
import type { TPublicState } from "@/helpers/state.helper";
// store
import type { RootStore } from "./root.store";

export interface IStateStore {
  // observables
  states: TPublicState[] | undefined;
  //computed
  sortedStates: TPublicState[] | undefined;
  // computed actions
  getStateById: (stateId: string | undefined) => TPublicState | undefined;
  // fetch actions
  fetchStates: (anchor: string) => Promise<TPublicState[]>;
}

export class StateStore implements IStateStore {
  states: TPublicState[] | undefined = undefined;
  projectService: PublicProjectService;
  rootStore: RootStore;

  constructor(_rootStore: RootStore) {
    makeObservable(this, {
      // observables
      states: observable,
      // computed
      sortedStates: computed,
      // fetch action
      fetchStates: action,
    });
    this.projectService = new PublicProjectService();
    this.rootStore = _rootStore;
  }

  get sortedStates() {
    if (!this.states) return;
    return sortStates(clone(this.states));
  }

  getStateById = (stateId: string | undefined) => this.states?.find((state) => state.id === stateId);

  fetchStates = async (anchor: string) => {
    const statesResponse = (await this.projectService.listStates(anchor)).map(toPublicState);
    runInAction(() => {
      this.states = statesResponse;
    });
    return statesResponse;
  };
}
