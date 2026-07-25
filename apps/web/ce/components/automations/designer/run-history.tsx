/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
import { AlertTriangle, CheckCircle2, CircleSlash, History } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Loader } from "@plane/ui";
import type { TAutomationRunStatus } from "@plane/types";
import { renderFormattedDate, renderFormattedTime } from "@plane/utils";
// hooks
import { useAutomation } from "@/hooks/store/use-automation";

type Props = {
  workspaceSlug: string;
  /** Omitted for workspace-scoped rules. */
  projectId?: string;
  automationId: string;
};

const STATUS_ICON: Record<TAutomationRunStatus, typeof CheckCircle2> = {
  success: CheckCircle2,
  failed: AlertTriangle,
  partial: AlertTriangle,
  skipped: CircleSlash,
};

const STATUS_CLASS: Record<TAutomationRunStatus, string> = {
  success: "text-success-primary",
  failed: "text-danger-primary",
  partial: "text-warning-primary",
  skipped: "text-tertiary",
};

const formatDuration = (durationMs: number): string =>
  durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;

/**
 * Recent executions with their per-action outcome, which is what makes a
 * misconfigured rule debuggable without server logs.
 */
export const AutomationRunHistory = observer(function AutomationRunHistory(props: Props) {
  const { workspaceSlug, projectId, automationId } = props;
  const { t } = useTranslation();
  const { fetchRuns, getRunsForAutomation } = useAutomation();

  const { isLoading } = useSWR(
    automationId ? `AUTOMATION_RUNS_${automationId}` : null,
    automationId ? () => fetchRuns(workspaceSlug, automationId, projectId) : null
  );

  const runs = getRunsForAutomation(automationId);

  return (
    <section className="rounded-lg border border-subtle bg-layer-2 p-4">
      <header className="mb-3 flex items-center gap-2">
        <div className="grid size-7 shrink-0 place-items-center rounded-sm bg-layer-3">
          <History className="size-4 text-accent-primary" />
        </div>
        <h3 className="text-body-sm-semibold">{t("automations.run_history.title")}</h3>
      </header>

      {isLoading && !runs ? (
        <Loader className="flex flex-col gap-2">
          <Loader.Item height="48px" />
          <Loader.Item height="48px" />
        </Loader>
      ) : !runs || runs.length === 0 ? (
        <p className="text-13 text-tertiary">{t("automations.run_history.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.map((run) => {
            const Icon = STATUS_ICON[run.status];
            return (
              <li key={run.id} className="rounded-md border border-subtle bg-surface-2 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className={`flex items-center gap-1.5 text-12 font-medium ${STATUS_CLASS[run.status]}`}>
                    <Icon className="size-3.5 shrink-0" />
                    {t(`automations.run_history.status_${run.status}`)}
                  </span>
                  <span className="text-12 text-tertiary">
                    {`${renderFormattedDate(run.started_at)} ${renderFormattedTime(run.started_at)}`}
                  </span>
                  <span className="text-12 text-tertiary">
                    {t("automations.run_history.duration")}: {formatDuration(run.duration_ms)}
                  </span>
                  <span className="text-12 text-tertiary">
                    {t("automations.run_history.trigger_source")}:{" "}
                    {t(`automations.run_history.source_${run.trigger_source}`)}
                  </span>
                </div>

                {run.steps.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 border-t border-subtle pt-2">
                    {run.steps.map((step) => (
                      <li key={step.action_id} className="flex flex-wrap gap-2 text-11">
                        <span className="font-medium text-secondary">
                          {t(`automations.action.handler_name.${step.action_type}`)}
                        </span>
                        {step.detail && <span className="text-tertiary">{step.detail}</span>}
                        {step.error && <span className="text-danger-primary">{step.error}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
});
