/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { observer } from "mobx-react";
import { useRouter } from "next/navigation";
// constants
import { ISSUE_DISPLAY_FILTERS_BY_LAYOUT } from "@plane/constants";
// components
import { FiltersDropdown } from "@/components/issues/filters/helpers/dropdown";
import { FilterSelection } from "@/components/issues/filters/selection";
// helpers
import { toggleFilterValue } from "@/helpers/filter.helper";
import { isIssuePriority } from "@/helpers/narrow.helper";
import { queryParamGenerator } from "@/helpers/query-param-generator";
// hooks
import { useIssueFilter } from "@/hooks/store/use-issue-filter";
// types
import type { TIssueFilterKeys } from "@/types/issue";

type IssueFiltersDropdownProps = {
  anchor: string;
};

export const IssueFiltersDropdown = observer(function IssueFiltersDropdown(props: IssueFiltersDropdownProps) {
  const { anchor } = props;
  // router
  const router = useRouter();
  // hooks
  const { getIssueFilters, updateIssueFilters } = useIssueFilter();
  // derived values
  const issueFilters = getIssueFilters(anchor);
  const activeLayout = issueFilters?.display_filters?.layout || undefined;

  const updateRouteParams = useCallback(
    (key: TIssueFilterKeys, value: string[]) => {
      const state = key === "state" ? value : (issueFilters?.filters?.state ?? []);
      const priority = key === "priority" ? value : (issueFilters?.filters?.priority ?? []);
      const labels = key === "labels" ? value : (issueFilters?.filters?.labels ?? []);

      const { queryParam } = queryParamGenerator({ board: activeLayout, priority, state, labels });
      router.push(`/issues/${anchor}?${queryParam}`);
    },
    [anchor, activeLayout, issueFilters, router]
  );

  const handleFilters = useCallback(
    (key: TIssueFilterKeys, value: string) => {
      if (!value) return;

      const newValues = toggleFilterValue(issueFilters?.filters?.[key] ?? [], value);

      if (key === "priority") updateIssueFilters(anchor, "filters", key, newValues.filter(isIssuePriority));
      else updateIssueFilters(anchor, "filters", key, newValues);
      updateRouteParams(key, newValues);
    },
    [anchor, issueFilters, updateIssueFilters, updateRouteParams]
  );

  return (
    <div className="relative">
      <FiltersDropdown title="Filters" placement="bottom-end">
        <FilterSelection
          filters={issueFilters?.filters ?? {}}
          handleFilters={handleFilters}
          layoutDisplayFiltersOptions={activeLayout ? ISSUE_DISPLAY_FILTERS_BY_LAYOUT?.[activeLayout]?.filters : []}
        />
      </FiltersDropdown>
    </div>
  );
});
