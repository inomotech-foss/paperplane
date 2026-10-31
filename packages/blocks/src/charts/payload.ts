/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TChartPayload, TChartValue } from "@plane/types";

export const isChartPayload = (value: unknown): value is TChartPayload =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((item) => typeof item === "string" || typeof item === "number");

export const toChartNumber = (value: TChartValue): number => Number(value);
