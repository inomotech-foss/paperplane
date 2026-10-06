/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const DEFAULT_SORT_ORDER = 65535;
export const SORT_ORDER_STEP = 10000;

export const RENUMBER_SIBLINGS = "renumber" as const;

export type TSortOrderResult = number | typeof RENUMBER_SIBLINGS;

export const renumberedSortOrder = (index: number): number => (index + 1) * SORT_ORDER_STEP;

// sibling sort orders exclude the dragged page; RENUMBER_SIBLINGS means no room between neighbours
export const getInsertSortOrder = (siblingSortOrders: number[], index: number): TSortOrderResult => {
  if (siblingSortOrders.length === 0) return DEFAULT_SORT_ORDER;
  if (index <= 0) return siblingSortOrders[0] - SORT_ORDER_STEP;
  if (index >= siblingSortOrders.length) return siblingSortOrders[siblingSortOrders.length - 1] + SORT_ORDER_STEP;
  const before = siblingSortOrders[index - 1];
  const after = siblingSortOrders[index];
  const midpoint = (before + after) / 2;
  if (before >= after || midpoint <= before || midpoint >= after) return RENUMBER_SIBLINGS;
  return midpoint;
};
