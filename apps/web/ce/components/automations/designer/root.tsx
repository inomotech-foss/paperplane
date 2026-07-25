/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Link } from "react-router";
import { debounce } from "lodash-es";
import { ArrowLeft, Filter, Play } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TAutomationConditionNode, TAutomationScheduleConfig, TAutomationTriggerType } from "@plane/types";
import { Loader, ToggleSwitch } from "@plane/ui";
// hooks
import { useAutomation } from "@/hooks/store/use-automation";
// local imports
import { useAutomationDetails, useAutomationMetadata } from "../helpers/metadata";
import { AutomationActionsBlock } from "./actions-block";
import { AutomationConditionBuilder } from "./condition-builder";
import { AutomationRunHistory } from "./run-history";
import { AutomationScopeBlock } from "./scope-block";
import { AutomationTriggerBlock } from "./trigger-block";

type Props = {
  workspaceSlug: string;
  /** Omitted for workspace-scoped rules, which live under workspace settings. */
  projectId?: string;
  automationId: string;
  /** Read-only when the viewer isn't a project admin. */
  disabled?: boolean;
};

/** How long to wait after the last keystroke before persisting a condition edit. */
const CONDITION_SAVE_DELAY_MS = 700;

export const AutomationDesignerRoot = observer(function AutomationDesignerRoot(props: Props) {
  const { workspaceSlug, projectId, automationId, disabled } = props;
  const { t } = useTranslation();
  const { updateAutomation, runNow } = useAutomation();
  const { metadata, isLoading: isMetadataLoading } = useAutomationMetadata(workspaceSlug);
  const { automation, isLoading } = useAutomationDetails(workspaceSlug, automationId, projectId);

  // The condition tree and schedule are edited locally and pushed on a debounce,
  // so typing a cron expression doesn't fire a request per keystroke.
  const [condition, setCondition] = useState<TAutomationConditionNode | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<TAutomationScheduleConfig>({ mode: "fixed" });
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    // Hydrate once per automation, so in-flight local edits are never clobbered
    // by the store update that our own PATCH triggers.
    if (!automation || hydratedFor.current === automation.id) return;
    hydratedFor.current = automation.id;
    setCondition(automation.condition);
    setScheduleConfig((automation.trigger_config as TAutomationScheduleConfig) ?? { mode: "fixed" });
  }, [automation]);

  const reportError = useCallback(
    (error: unknown) => {
      const payload = error as Record<string, string | string[]> | undefined;
      const firstDetail = payload
        ? Object.values(payload)
            .flat()
            .find((value) => typeof value === "string")
        : undefined;
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("automations.toasts.update.error.title"),
        message: firstDetail ?? t("automations.toasts.update.error.message"),
      });
    },
    [t]
  );

  const persist = useRef(
    debounce(
      (
        slug: string,
        project: string | undefined,
        id: string,
        payload: Parameters<typeof updateAutomation>[2],
        update: typeof updateAutomation,
        onError: (error: unknown) => void
      ) => {
        update(slug, id, payload, project).catch(onError);
      },
      CONDITION_SAVE_DELAY_MS
    )
  ).current;

  // Send the last pending edit rather than dropping it when the page unmounts.
  useEffect(() => () => persist.flush(), [persist]);

  const handleConditionChange = (next: TAutomationConditionNode | null) => {
    setCondition(next);
    persist(workspaceSlug, projectId, automationId, { condition: next }, updateAutomation, reportError);
  };

  const handleScheduleChange = (next: TAutomationScheduleConfig) => {
    setScheduleConfig(next);
    // A cron expression is only worth sending once it has all five fields —
    // otherwise every keystroke round-trips to a 400 and an error toast.
    if (next.mode === "cron" && (next.cron ?? "").trim().split(/\s+/).length !== 5) return;
    persist(workspaceSlug, projectId, automationId, { trigger_config: next }, updateAutomation, reportError);
  };

  const handleScopeChange = async (payload: { applies_to_all_projects?: boolean; project_ids?: string[] }) => {
    try {
      await updateAutomation(workspaceSlug, automationId, payload, projectId);
    } catch (error) {
      reportError(error);
    }
  };

  const handleTriggerChange = async (triggerType: TAutomationTriggerType) => {
    try {
      const payload: Parameters<typeof updateAutomation>[2] = { trigger_type: triggerType };
      if (triggerType === "schedule") {
        // Seed a schedule the backend will accept so saving the trigger can't fail.
        const seeded: TAutomationScheduleConfig = {
          mode: "fixed",
          frequency: "daily",
          hour: 9,
          minute: 0,
          timezone: scheduleConfig.timezone ?? "UTC",
          scheduled_target: "work_items",
        };
        payload.trigger_config = seeded;
        setScheduleConfig(seeded);
      }
      await updateAutomation(workspaceSlug, automationId, payload, projectId);
    } catch (error) {
      reportError(error);
    }
  };

  const handleToggleEnabled = async () => {
    if (!automation) return;
    setIsTogglingEnabled(true);
    try {
      // Flush any pending condition edit first, so enabling validates the tree
      // the author is actually looking at.
      persist.flush();
      await updateAutomation(workspaceSlug, automationId, { is_enabled: !automation.is_enabled }, projectId);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t(
          automation.is_enabled ? "automations.toasts.disable.success.title" : "automations.toasts.enable.success.title"
        ),
        message: t(
          automation.is_enabled
            ? "automations.toasts.disable.success.message"
            : "automations.toasts.enable.success.message"
        ),
      });
    } catch (error) {
      const payload = error as { is_enabled?: string };
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("automations.toasts.enable.error.title"),
        message: payload?.is_enabled ?? t("automations.enable.validation.required"),
      });
    } finally {
      setIsTogglingEnabled(false);
    }
  };

  const handleRunNow = async () => {
    try {
      await runNow(workspaceSlug, automationId, projectId);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("automations.toasts.run_now.success.title"),
        message: t("automations.toasts.run_now.success.message"),
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("automations.toasts.run_now.error.title"),
        message: (error as { error?: string })?.error ?? t("automations.toasts.run_now.error.message"),
      });
    }
  };

  if (isLoading || isMetadataLoading) {
    return (
      <Loader className="flex flex-col gap-4">
        <Loader.Item height="60px" />
        <Loader.Item height="160px" />
        <Loader.Item height="160px" />
      </Loader>
    );
  }

  if (!automation) {
    return <p className="text-13 text-tertiary">{t("automations.designer.not_found")}</p>;
  }

  const listHref = projectId
    ? `/${workspaceSlug}/settings/projects/${projectId}/automations/`
    : `/${workspaceSlug}/settings/automations/`;

  return (
    <div className="flex flex-col gap-4">
      <Link to={listHref} className="flex w-fit items-center gap-1.5 text-12 text-secondary hover:text-primary">
        <ArrowLeft className="size-3.5" />
        {t("automations.designer.back_to_list")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-body-lg-semibold truncate">{automation.name}</h2>
          {automation.description && <p className="mt-0.5 text-13 text-tertiary">{automation.description}</p>}
          {automation.schedule_summary && <p className="mt-1 text-12 text-tertiary">{automation.schedule_summary}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {automation.is_enabled && (
            <Button variant="secondary" size="lg" prependIcon={<Play />} onClick={handleRunNow} disabled={disabled}>
              {t("automations.designer.run_now")}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-13 text-secondary">
              {t(automation.is_enabled ? "automations.designer.enabled" : "automations.designer.disabled")}
            </span>
            <ToggleSwitch
              value={automation.is_enabled}
              onChange={handleToggleEnabled}
              size="sm"
              disabled={disabled || isTogglingEnabled}
            />
          </div>
        </div>
      </header>

      {!automation.is_enabled && (
        <p className="rounded-md border border-subtle bg-surface-2 px-3 py-2 text-12 text-tertiary">
          {t("automations.enable.alert")}
        </p>
      )}

      {automation.scope === "workspace" && (
        <AutomationScopeBlock automation={automation} onChange={handleScopeChange} disabled={disabled} />
      )}

      <AutomationTriggerBlock
        metadata={metadata}
        triggerType={automation.trigger_type}
        triggerConfig={scheduleConfig}
        triggerLocked={!!automation.trigger_type}
        onTriggerChange={handleTriggerChange}
        onConfigChange={handleScheduleChange}
        disabled={disabled}
      />

      <section className="rounded-lg border border-subtle bg-layer-2 p-4">
        <header className="mb-3 flex items-center gap-2">
          <div className="grid size-7 shrink-0 place-items-center rounded-sm bg-layer-3">
            <Filter className="size-4 text-accent-primary" />
          </div>
          <h3 className="text-body-sm-semibold">{t("automations.condition.label")}</h3>
        </header>
        {!condition && <p className="mb-2 text-13 text-tertiary">{t("automations.designer.no_conditions")}</p>}
        {automation.scope === "workspace" && (
          <p className="mb-2 text-11 text-tertiary">{t("automations.designer.workspace_scope_note")}</p>
        )}
        <AutomationConditionBuilder
          projectId={projectId}
          scope={automation.scope}
          metadata={metadata}
          condition={condition}
          onChange={handleConditionChange}
          disabled={disabled}
        />
      </section>

      <AutomationActionsBlock
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        automation={automation}
        metadata={metadata}
        disabled={disabled}
      />

      <AutomationRunHistory workspaceSlug={workspaceSlug} projectId={projectId} automationId={automationId} />
    </div>
  );
});
