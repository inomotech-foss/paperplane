/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { Tabs, TabsList, Tab, TabsPanel } from "@makeplane/propel/components/tabs";
import { useTranslation } from "@plane/i18n";
import type { TWorkItemFilterCondition } from "@plane/shared-state";
import type {
  TCycleAssigneesDistribution,
  TCycleDistribution,
  TCycleDistributionBase,
  TCycleEstimateDistribution,
  TCycleEstimateDistributionBase,
  TCycleLabelsDistribution,
} from "@plane/types";
import { toFilterArray } from "@plane/utils";
// components
import type { TAssigneeData } from "@/components/core/sidebar/progress-stats/assignee";
import { AssigneeStatComponent } from "@/components/core/sidebar/progress-stats/assignee";
import type { TLabelData } from "@/components/core/sidebar/progress-stats/label";
import { LabelStatComponent } from "@/components/core/sidebar/progress-stats/label";
import type { TSelectedFilterProgressStats } from "@/components/core/sidebar/progress-stats/shared";
import { createFilterUpdateHandler, PROGRESS_STATS } from "@/components/core/sidebar/progress-stats/shared";
import type { TStateGroupData } from "@/components/core/sidebar/progress-stats/state_group";
import { StateGroupStatComponent } from "@/components/core/sidebar/progress-stats/state_group";
// helpers
// hooks
import { isString } from "@/helpers/narrow.helper";
import useLocalStorage from "@/hooks/use-local-storage";

type TDistributionBase = TCycleDistributionBase | TCycleEstimateDistributionBase;

const getDistributionCounts = (item: TDistributionBase) =>
  "completed_issues" in item
    ? { completed: item.completed_issues, total: item.total_issues }
    : { completed: item.completed_estimates, total: item.total_estimates };

type TCycleProgressStats = {
  cycleId: string;
  distribution: TCycleDistribution | TCycleEstimateDistribution | undefined;
  groupedIssues: Record<string, number>;
  handleFiltersUpdate: (condition: TWorkItemFilterCondition) => void;
  isEditable?: boolean;
  selectedFilters: TSelectedFilterProgressStats;
  totalIssuesCount: number;
};

export const CycleProgressStats = observer(function CycleProgressStats(props: TCycleProgressStats) {
  const {
    cycleId,
    distribution,
    groupedIssues,
    handleFiltersUpdate,
    isEditable = false,
    selectedFilters,
    totalIssuesCount,
  } = props;
  // plane imports
  const { t } = useTranslation();
  // store imports
  const { storedValue: currentTab, setValue: setCycleTab } = useLocalStorage(
    `cycle-analytics-tab-${cycleId}`,
    "stat-assignees"
  );
  // derived values
  const selectedAssigneeIds = toFilterArray(selectedFilters?.assignees?.value || []).filter(isString);
  const selectedLabelIds = toFilterArray(selectedFilters?.labels?.value || []).filter(isString);
  const selectedStateGroups = toFilterArray(selectedFilters?.stateGroups?.value || []).filter(isString);

  const assignees: (TCycleAssigneesDistribution & TDistributionBase)[] = distribution?.assignees || [];
  const distributionAssigneeData: TAssigneeData = assignees.map((assignee) => ({
    id: assignee?.assignee_id || undefined,
    title: assignee?.display_name || undefined,
    avatar_url: assignee?.avatar_url || undefined,
    ...getDistributionCounts(assignee),
  }));

  const labels: (TCycleLabelsDistribution & TDistributionBase)[] = distribution?.labels || [];
  const distributionLabelData: TLabelData = labels.map((label) => ({
    id: label?.label_id || undefined,
    title: label?.label_name || undefined,
    color: label?.color || undefined,
    ...getDistributionCounts(label),
  }));

  const distributionStateData: TStateGroupData = Object.keys(groupedIssues || {}).map((state) => ({
    state: state,
    completed: groupedIssues?.[state] || 0,
    total: totalIssuesCount || 0,
  }));

  const handleAssigneeFiltersUpdate = createFilterUpdateHandler(
    "assignee_id",
    selectedAssigneeIds,
    handleFiltersUpdate
  );
  const handleLabelFiltersUpdate = createFilterUpdateHandler("label_id", selectedLabelIds, handleFiltersUpdate);
  const handleStateGroupFiltersUpdate = createFilterUpdateHandler(
    "state_group",
    selectedStateGroups,
    handleFiltersUpdate
  );

  return (
    <div>
      <Tabs
        variant="contained"
        stretch="full"
        defaultValue={currentTab ?? "stat-assignees"}
        onValueChange={(value: string) => setCycleTab(value)}
      >
        <TabsList>
          {PROGRESS_STATS.map((stat) => (
            <Tab key={stat.key} value={stat.key} label={t(stat.i18n_title)} />
          ))}
        </TabsList>
        <div className="w-full py-3 text-secondary">
          <TabsPanel value="stat-states">
            <StateGroupStatComponent
              distribution={distributionStateData}
              handleStateGroupFiltersUpdate={handleStateGroupFiltersUpdate}
              isEditable={isEditable}
              selectedStateGroups={selectedStateGroups}
              totalIssuesCount={totalIssuesCount}
            />
          </TabsPanel>
          <TabsPanel value="stat-assignees">
            <AssigneeStatComponent
              distribution={distributionAssigneeData}
              handleAssigneeFiltersUpdate={handleAssigneeFiltersUpdate}
              isEditable={isEditable}
              selectedAssigneeIds={selectedAssigneeIds}
            />
          </TabsPanel>
          <TabsPanel value="stat-labels">
            <LabelStatComponent
              distribution={distributionLabelData}
              handleLabelFiltersUpdate={handleLabelFiltersUpdate}
              isEditable={isEditable}
              selectedLabelIds={selectedLabelIds}
            />
          </TabsPanel>
        </div>
      </Tabs>
    </div>
  );
});
