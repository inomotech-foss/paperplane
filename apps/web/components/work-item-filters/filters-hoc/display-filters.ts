// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { isEqual } from "lodash-es";
import { DEFAULT_TIMELINE_COLOR_BY } from "@plane/constants";
import type { IIssueDisplayFilterOptions } from "@plane/types";

const withoutDefaultColorBy = (filters: IIssueDisplayFilterOptions | undefined) => {
  if (!filters) return filters;
  const { color_by: colorBy, ...rest } = filters;
  return colorBy && colorBy !== DEFAULT_TIMELINE_COLOR_BY ? filters : rest;
};

/** Whether the applied display filters differ from a saved view's, treating an unset colour source as the default. */
export const hasDisplayFilterChanges = (
  applied: IIssueDisplayFilterOptions | undefined,
  saved: IIssueDisplayFilterOptions | undefined
): boolean => !isEqual(withoutDefaultColorBy(applied), withoutDefaultColorBy(saved));
