/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, computed, makeObservable, observable, runInAction } from "mobx";
// types
import type { TUserTrainingProgress } from "@plane/types";
// constants
import { TRAININGS_REGISTRY } from "@/constants/trainings";
// services
import { TrainingService } from "@/services/training.service";

export interface IUserTrainingsStore {
  // observables
  isLoading: boolean;
  progress: Record<string, TUserTrainingProgress>;
  // computed
  unseenCount: number;
  unseenKeys: string[];
  // helpers
  isNew: (trainingKey: string) => boolean;
  isCompleted: (trainingKey: string) => boolean;
  getCompletedSteps: (trainingKey: string) => string[];
  // actions
  fetchProgress: () => Promise<void>;
  markSeen: (trainingKeys: string[]) => Promise<void>;
  markStepCompleted: (trainingKey: string, stepKey: string) => Promise<void>;
  markCompleted: (trainingKey: string) => Promise<void>;
}

export class UserTrainingsStore implements IUserTrainingsStore {
  isLoading: boolean = false;
  progress: Record<string, TUserTrainingProgress> = {};

  // services
  trainingService: TrainingService;

  constructor() {
    makeObservable(this, {
      // observables
      isLoading: observable.ref,
      progress: observable,
      // computed
      unseenCount: computed,
      unseenKeys: computed,
      // actions
      fetchProgress: action,
      markSeen: action,
      markStepCompleted: action,
      markCompleted: action,
    });
    this.trainingService = new TrainingService();
  }

  get unseenKeys(): string[] {
    return TRAININGS_REGISTRY.filter((training) => !this.progress[training.key]?.seen_at).map(
      (training) => training.key
    );
  }

  get unseenCount(): number {
    return this.unseenKeys.length;
  }

  isNew = (trainingKey: string): boolean => !this.progress[trainingKey]?.seen_at;

  isCompleted = (trainingKey: string): boolean => !!this.progress[trainingKey]?.completed_at;

  getCompletedSteps = (trainingKey: string): string[] => this.progress[trainingKey]?.completed_steps ?? [];

  fetchProgress = async (): Promise<void> => {
    try {
      runInAction(() => {
        this.isLoading = true;
      });
      const response = await this.trainingService.getProgress();
      runInAction(() => {
        this.progress = Object.fromEntries(response.map((row) => [row.training_key, row]));
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      console.error("Failed to fetch user training progress", error);
    }
  };

  markSeen = async (trainingKeys: string[]): Promise<void> => {
    if (trainingKeys.length === 0) return;
    try {
      const response = await this.trainingService.markSeen(trainingKeys);
      runInAction(() => {
        response.forEach((row) => {
          this.progress[row.training_key] = row;
        });
      });
    } catch (error) {
      console.error("Failed to mark trainings as seen", error);
    }
  };

  markStepCompleted = async (trainingKey: string, stepKey: string): Promise<void> => {
    if (this.getCompletedSteps(trainingKey).includes(stepKey)) return;
    try {
      const response = await this.trainingService.updateProgress(trainingKey, {
        seen: true,
        completed_steps: [stepKey],
      });
      runInAction(() => {
        this.progress[trainingKey] = response;
      });
    } catch (error) {
      console.error("Failed to update training step progress", error);
    }
  };

  markCompleted = async (trainingKey: string): Promise<void> => {
    try {
      const training = TRAININGS_REGISTRY.find((item) => item.key === trainingKey);
      const response = await this.trainingService.updateProgress(trainingKey, {
        seen: true,
        completed: true,
        completed_steps: training?.steps.map((step) => step.key),
      });
      runInAction(() => {
        this.progress[trainingKey] = response;
      });
    } catch (error) {
      console.error("Failed to mark training as completed", error);
    }
  };
}
