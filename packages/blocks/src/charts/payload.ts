/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TChartPayload } from "@plane/types";

// Recharts hands the drawn datum to its callbacks without a type.
export const isChartPayload = (value: unknown): value is TChartPayload =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readField = (source: unknown, key: string): unknown =>
  typeof source === "object" && source !== null ? Reflect.get(source, key) : undefined;

export const toChartNumber = (value: unknown): number => Number(value);

export const toChartText = (value: unknown): string | number | undefined =>
  typeof value === "string" || typeof value === "number" ? value : undefined;

export const toChartKey = (value: unknown): string | null => (typeof value === "string" ? value : null);

export const toChartLabel = (value: unknown): string => {
  const text = toChartText(value);
  return text === undefined ? "" : String(text);
};

const TEXT_ANCHORS = ["start", "middle", "end", "inherit"] as const;

export const toTextAnchor = (value: unknown) => TEXT_ANCHORS.find((anchor) => anchor === value);

const DOMINANT_BASELINES = [
  "auto",
  "use-script",
  "no-change",
  "reset-size",
  "ideographic",
  "alphabetic",
  "hanging",
  "mathematical",
  "central",
  "middle",
  "text-after-edge",
  "text-before-edge",
  "inherit",
] as const;

export const toDominantBaseline = (value: unknown) => DOMINANT_BASELINES.find((baseline) => baseline === value);
