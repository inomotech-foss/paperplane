/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { observer } from "mobx-react";
// plane imports
import type { TModuleFilters } from "@plane/types";
import { calculateTotalFilters } from "@plane/utils";
// components
import { PageHead } from "@/components/core/page-title";
import { ModuleAppliedFiltersList, ModulesListView } from "@/components/modules";
// hooks
import { useModuleFilter } from "@/hooks/store/use-module-filter";
import { useProject } from "@/hooks/store/use-project";
import type { Route } from "./+types/page";

function ProjectModulesPage({ params }: Route.ComponentProps) {
  const { projectId } = params;
  // store
  const { getProjectById } = useProject();
  const {
    currentProjectFilters = {},
    currentProjectDisplayFilters,
    clearAllFilters,
    updateFilters,
    updateDisplayFilters,
  } = useModuleFilter();
  // derived values
  const project = getProjectById(projectId);
  const pageTitle = project?.name ? `${project?.name} - Modules` : undefined;

  const handleRemoveFilter = useCallback(
    (key: keyof TModuleFilters, value: string | null) => {
      let newValues = currentProjectFilters[key] ?? [];

      if (!value) newValues = [];
      else newValues = newValues.filter((val) => val !== value);

      updateFilters(projectId, { [key]: newValues });
    },
    [currentProjectFilters, projectId, updateFilters]
  );

  return (
    <>
      <PageHead title={pageTitle} />
      <div className="flex h-full w-full flex-col">
        {(calculateTotalFilters(currentProjectFilters) !== 0 || currentProjectDisplayFilters?.favorites) && (
          <ModuleAppliedFiltersList
            appliedFilters={currentProjectFilters}
            isFavoriteFilterApplied={currentProjectDisplayFilters?.favorites ?? false}
            handleClearAllFilters={() => clearAllFilters(projectId)}
            handleRemoveFilter={handleRemoveFilter}
            handleDisplayFiltersUpdate={(val) => updateDisplayFilters(projectId, val)}
            alwaysAllowEditing
          />
        )}
        <ModulesListView />
      </div>
    </>
  );
}

export default observer(ProjectModulesPage);
