/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, makeObservable, observable, runInAction } from "mobx";
// plane imports
import type { TPublicCycle } from "@/types/cycle";
// store
import { PublicProjectService } from "@/services/project.service";
import type { RootStore } from "./root.store";

export interface ICycleStore {
  // observables
  cycles: TPublicCycle[] | undefined;
  // computed actions
  getCycleById: (cycleId: string | undefined) => TPublicCycle | undefined;
  // fetch actions
  fetchCycles: (anchor: string) => Promise<TPublicCycle[]>;
}

export class CycleStore implements ICycleStore {
  cycles: TPublicCycle[] | undefined = undefined;
  projectService: PublicProjectService;
  rootStore: RootStore;

  constructor(_rootStore: RootStore) {
    makeObservable(this, {
      // observables
      cycles: observable,
      // fetch action
      fetchCycles: action,
    });
    this.projectService = new PublicProjectService();
    this.rootStore = _rootStore;
  }

  getCycleById = (cycleId: string | undefined) => this.cycles?.find((cycle) => cycle.id === cycleId);

  fetchCycles = async (anchor: string) => {
    const cyclesResponse = await this.projectService.listCycles(anchor);
    runInAction(() => {
      this.cycles = cyclesResponse;
    });
    return cyclesResponse;
  };
}
