/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import type { EEstimateSystem, EEstimateUpdateStages } from "./enums";

export interface IEstimatePoint {
  id: string | undefined;
  key: number | undefined;
  value: string | undefined;
  description: string | undefined;
  workspace: string | undefined;
  project: string | undefined;
  estimate: string | undefined;
  created_at: string | undefined;
  updated_at: string | undefined;
  created_by: string | null | undefined;
  updated_by: string | null | undefined;
}

export type TEstimateSystemKeys = EEstimateSystem.POINTS | EEstimateSystem.CATEGORIES | EEstimateSystem.TIME;

/** The estimate systems the API stores. */
export type TEstimateType = ApiSchema<"EstimateTypeEnum">;

export interface IEstimate {
  id: string | undefined;
  name: string | undefined;
  description: string | undefined;
  type: TEstimateSystemKeys | undefined;
  points: IEstimatePoint[] | undefined;
  workspace: string | undefined;
  project: string | undefined;
  last_used: boolean | undefined;
  created_at: string | undefined;
  updated_at: string | undefined;
  created_by: string | null | undefined;
  updated_by: string | null | undefined;
}

export interface IEstimateFormData {
  estimate?: {
    name?: string;
    type?: string;
    last_used?: boolean;
  };
  estimate_points: {
    id?: string | undefined;
    key: number;
    value: string;
  }[];
}

export type TEstimatePointsObject = {
  id?: string | undefined;
  key: number;
  value: string;
};

export type TTemplateValues = {
  title: string;
  i18n_title: string;
  values: TEstimatePointsObject[];
  hide?: boolean;
};

export type TEstimateSystem = {
  name: string;
  i18n_name: string;
  templates: Record<string, TTemplateValues>;
  is_available: boolean;
  is_ee: boolean;
};

export type TEstimateSystems = {
  [K in TEstimateSystemKeys]: TEstimateSystem;
};

// update estimates
export type TEstimateUpdateStageKeys =
  | EEstimateUpdateStages.CREATE
  | EEstimateUpdateStages.EDIT
  | EEstimateUpdateStages.SWITCH;

export type TEstimateTypeErrorObject = {
  oldValue: string;
  newValue: string;
  message: string | undefined;
};

export type TEstimateTypeError = Record<number, TEstimateTypeErrorObject> | undefined;
