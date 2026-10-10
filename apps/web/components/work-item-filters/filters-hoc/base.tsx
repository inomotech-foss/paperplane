/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useLayoutEffect, useState } from "react";
import { observer } from "mobx-react";
import { v4 as uuidv4 } from "uuid";
// plane imports
import type { TSaveViewOptions, TUpdateViewOptions } from "@plane/constants";
import type { IWorkItemFilterInstance } from "@plane/shared-state";
import type { IIssueFilters, TWorkItemFilterExpression } from "@plane/types";
// store hooks
import { useWorkItemFilters } from "@/hooks/store/work-item-filters/use-work-item-filters";
// plane web imports
import type { TWorkItemFiltersEntityProps } from "@/hooks/work-item-filters/use-work-item-filters-config";
import { useWorkItemFiltersConfig } from "@/hooks/work-item-filters/use-work-item-filters-config";
// local imports
import type { TSharedWorkItemFiltersHOCProps, TSharedWorkItemFiltersProps } from "./shared";

type TAdditionalWorkItemFiltersProps = {
  saveViewOptions?: TSaveViewOptions<TWorkItemFilterExpression>;
  updateViewOptions?: TUpdateViewOptions<TWorkItemFilterExpression>;
} & TWorkItemFiltersEntityProps;

type TWorkItemFiltersHOCProps = TSharedWorkItemFiltersHOCProps & TAdditionalWorkItemFiltersProps;

export const WorkItemFiltersHOC = observer(function WorkItemFiltersHOC(props: TWorkItemFiltersHOCProps) {
  const { children, initialWorkItemFilters } = props;

  // Only initialize filter instance when initial work item filters are defined
  if (!initialWorkItemFilters)
    return <>{typeof children === "function" ? children({ filter: undefined }) : children}</>;

  return (
    <WorkItemFilterRoot {...props} initialWorkItemFilters={initialWorkItemFilters}>
      {children}
    </WorkItemFilterRoot>
  );
});

type TWorkItemFilterProps = TSharedWorkItemFiltersProps &
  TAdditionalWorkItemFiltersProps & {
    initialWorkItemFilters: IIssueFilters;
    children: React.ReactNode | ((props: { filter: IWorkItemFilterInstance }) => React.ReactNode);
  };

const WorkItemFilterRoot = observer(function WorkItemFilterRoot(props: TWorkItemFilterProps) {
  const {
    children,
    clearFilterOptions,
    entityType,
    entityId,
    filtersToShowByLayout,
    initialWorkItemFilters,
    isTemporary,
    saveViewOptions,
    updateFilters,
    updateViewOptions,
    showOnMount,
    ...entityConfigProps
  } = props;
  // states
  const [temporaryId] = useState(() => uuidv4());
  // store hooks
  const { getFilter, getOrCreateFilter, deleteFilter } = useWorkItemFilters();
  // derived values
  const workItemEntityID = isTemporary ? `TEMP-${entityId ?? temporaryId}` : entityId;
  const workItemLayoutFilter = getFilter(entityType, workItemEntityID);
  const workItemFiltersConfig = useWorkItemFiltersConfig({
    allowedFilters: filtersToShowByLayout ? filtersToShowByLayout : [],
    ...entityConfigProps,
  });

  useLayoutEffect(() => () => deleteFilter(entityType, workItemEntityID), [deleteFilter, entityType, workItemEntityID]);

  // Creating the filter re-renders other observers, so it must not happen during render. A layout
  // effect still runs before the first paint. On an existing filter this only refreshes the options.
  useLayoutEffect(() => {
    getOrCreateFilter({
      entityType,
      entityId: workItemEntityID,
      initialExpression: initialWorkItemFilters.richFilters,
      onExpressionChange: updateFilters,
      expressionOptions: { clearFilterOptions, saveViewOptions, updateViewOptions },
      showOnMount,
    });
  }, [
    clearFilterOptions,
    entityType,
    getOrCreateFilter,
    initialWorkItemFilters.richFilters,
    saveViewOptions,
    showOnMount,
    updateFilters,
    updateViewOptions,
    workItemEntityID,
  ]);

  useEffect(() => {
    if (!workItemLayoutFilter) return;
    workItemLayoutFilter.configManager.setAreConfigsReady(workItemFiltersConfig.areAllConfigsInitialized);
    workItemLayoutFilter.configManager.registerAll(workItemFiltersConfig.configs);
  }, [workItemFiltersConfig.areAllConfigsInitialized, workItemFiltersConfig.configs, workItemLayoutFilter]);

  if (!workItemLayoutFilter) return null;
  return <>{typeof children === "function" ? children({ filter: workItemLayoutFilter }) : children}</>;
});
