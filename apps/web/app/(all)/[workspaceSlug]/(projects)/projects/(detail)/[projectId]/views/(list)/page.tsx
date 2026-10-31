/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { observer } from "mobx-react";
// plane imports
import type { EViewAccess, TViewFilterProps } from "@plane/types";
import { Header, EHeaderVariant } from "@plane/blocks/layout";
import { calculateTotalFilters } from "@plane/utils";
// components
import { PageHead } from "@/components/core/page-title";
import { ViewAppliedFiltersList } from "@/components/views/applied-filters";
import { ProjectViewsList } from "@/components/views/views-list";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectView } from "@/hooks/store/use-project-view";
import type { Route } from "./+types/page";

const removeFilterValue = <V, E extends null | undefined>(values: V[] | E, value: unknown): V[] | E => {
  if (!Array.isArray(values)) return values;
  return value ? values.filter((val) => val !== value) : [];
};

function ProjectViewsPage({ params }: Route.ComponentProps) {
  const { projectId } = params;
  // store
  const { getProjectById } = useProject();
  const { filters, updateFilters, clearAllFilters } = useProjectView();
  // derived values
  const project = getProjectById(projectId);
  const pageTitle = project?.name ? `${project?.name} - Views` : undefined;

  const handleRemoveFilter = useCallback(
    (key: keyof TViewFilterProps, value: string | EViewAccess | null) => {
      const current = filters.filters;

      if (key === "favorites") updateFilters("filters", { favorites: !!value });
      else if (key === "view_type")
        updateFilters("filters", { view_type: removeFilterValue(current?.view_type, value) });
      else updateFilters("filters", { [key]: removeFilterValue(current?.[key], value) });
    },
    [filters.filters, updateFilters]
  );

  const isFiltersApplied = calculateTotalFilters(filters?.filters ?? {}) !== 0;

  return (
    <>
      <PageHead title={pageTitle} />
      {isFiltersApplied && (
        <Header variant={EHeaderVariant.TERNARY}>
          <ViewAppliedFiltersList
            appliedFilters={filters.filters ?? {}}
            handleClearAllFilters={clearAllFilters}
            handleRemoveFilter={handleRemoveFilter}
            alwaysAllowEditing
          />
        </Header>
      )}
      <ProjectViewsList />
    </>
  );
}

export default observer(ProjectViewsPage);
