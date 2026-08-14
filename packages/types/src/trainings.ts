/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TUserTrainingProgress = {
  training_key: string;
  seen_at: string | null;
  completed_at: string | null;
  completed_steps: string[];
};

export type TUserTrainingProgressPayload = {
  seen?: boolean;
  completed?: boolean;
  completed_steps?: string[];
};
