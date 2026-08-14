/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// helpers
import { API_BASE_URL } from "@plane/constants";
import type { TUserTrainingProgress, TUserTrainingProgressPayload } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class TrainingService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getProgress(): Promise<TUserTrainingProgress[]> {
    return this.get("/api/users/me/trainings/")
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }

  async markSeen(trainingKeys: string[]): Promise<TUserTrainingProgress[]> {
    return this.post("/api/users/me/trainings/", { training_keys: trainingKeys, seen: true })
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }

  async updateProgress(trainingKey: string, payload: TUserTrainingProgressPayload): Promise<TUserTrainingProgress> {
    return this.post(`/api/users/me/trainings/${trainingKey}/`, payload)
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }
}
