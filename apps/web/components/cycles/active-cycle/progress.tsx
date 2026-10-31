/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment } from "react";
import { observer } from "mobx-react";
import { useTheme } from "next-themes";
// plane imports
import { PROGRESS_STATE_GROUPS_DETAILS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TWorkItemFilterCondition } from "@plane/shared-state";
import { LinearProgress } from "@makeplane/propel/components/linear-progress";
import type { ICycle } from "@plane/types";
import { Loader } from "@plane/blocks/skeleton";
// assets
import darkProgressAsset from "@/app/assets/empty-state/active-cycle/progress-dark.webp?url";
import lightProgressAsset from "@/app/assets/empty-state/active-cycle/progress-light.webp?url";
// components
import { SimpleEmptyState } from "@/components/empty-state/simple-empty-state-root";

export type ActiveCycleProgressProps = {
  cycle: ICycle | null;
  workspaceSlug: string;
  projectId: string;
  handleFiltersUpdate: (conditions: TWorkItemFilterCondition[]) => void;
};

export const ActiveCycleProgress = observer(function ActiveCycleProgress(props: ActiveCycleProgressProps) {
  const { handleFiltersUpdate, cycle } = props;
  // theme hook
  const { resolvedTheme } = useTheme();
  // plane hooks
  const { t } = useTranslation();
  // derived values
  const totalIssues = cycle?.total_issues ?? 0;
  const cancelledIssues = cycle?.cancelled_issues ?? 0;
  const closedIssues = (cycle?.completed_issues ?? 0) + cancelledIssues;
  const closableIssues = totalIssues - cancelledIssues;
  const progressValue = closableIssues > 0 ? (closedIssues / closableIssues) * 100 : 0;
  const groupedIssues: Record<string, number> = cycle
    ? {
        completed: cycle.completed_issues ?? 0,
        started: cycle.started_issues ?? 0,
        unstarted: cycle.unstarted_issues ?? 0,
        backlog: cycle.backlog_issues ?? 0,
      }
    : {};
  const resolvedPath = resolvedTheme === "light" ? lightProgressAsset : darkProgressAsset;

  return cycle && cycle.hasOwnProperty("started_issues") ? (
    <div className="flex min-h-[17rem] flex-col gap-5 rounded-lg border border-subtle bg-surface-1 px-3.5 py-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-14 font-semibold text-tertiary">{t("project_cycles.active_cycle.progress")}</h3>
          {totalIssues > 0 && (
            <span className="flex gap-1 rounded-xs px-3 py-1 text-13 font-medium whitespace-nowrap text-placeholder">
              {`${closedIssues}/${closableIssues} ${closedIssues > 1 ? "Work items" : "Work item"} closed`}
            </span>
          )}
        </div>
        {totalIssues > 0 && (
          <LinearProgress
            value={progressValue}
            size="md"
            variant="brand"
            showValue={false}
            aria-label="Cycle progress"
          />
        )}
      </div>

      {totalIssues > 0 ? (
        <div className="flex flex-col gap-5">
          {Object.entries(groupedIssues).map(([group, count], index) => (
            <Fragment key={group}>
              {count > 0 && (
                <div>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-2 text-left text-13"
                    onClick={() => {
                      handleFiltersUpdate([{ property: "state_group", operator: "in", value: [group] }]);
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="block h-3 w-3 rounded-full"
                        style={{
                          backgroundColor: PROGRESS_STATE_GROUPS_DETAILS[index].color,
                        }}
                      />
                      <span className="w-16 font-medium text-tertiary capitalize">{group}</span>
                    </div>
                    <span className="text-tertiary">{`${count} ${count > 1 ? "Work items" : "Work item"}`}</span>
                  </button>
                </div>
              )}
            </Fragment>
          ))}
          {cancelledIssues > 0 && (
            <span className="flex items-center gap-2 text-13 text-tertiary">
              <span>
                {`${cancelledIssues} cancelled ${
                  cancelledIssues > 1 ? "work items are" : "work item is"
                } excluded from this report.`}{" "}
              </span>
            </span>
          )}
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <SimpleEmptyState title={t("active_cycle.empty_state.progress.title")} assetPath={resolvedPath} />
        </div>
      )}
    </div>
  ) : (
    <Loader className="flex min-h-[17rem] flex-col gap-5 rounded-lg border border-subtle bg-surface-1">
      <Loader.Item width="100%" height="100%" />
    </Loader>
  );
});
