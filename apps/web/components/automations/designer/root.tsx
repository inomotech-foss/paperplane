/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Link } from "react-router";
import { debounce } from "lodash-es";
import { ArrowLeft, Play } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { Switch } from "@makeplane/propel/components/switch";
import { setToast } from "@plane/blocks/toast";
import type { TAutomationConditionNode, TAutomationScheduleConfig, TAutomationTriggerType } from "@plane/types";
import { Loader } from "@plane/blocks/skeleton";
// hooks
import { useAutomation } from "@/hooks/store/use-automation";
import { getApiErrorBody } from "@/helpers/error.helper";
import { isObject, readString } from "@plane/types";
import { getFirstStringField, isString } from "@/helpers/narrow.helper";
import type { IAutomationStore } from "@/store/automation.store";
// local imports
import { describeEnableErrors, parseEnableErrors } from "../helpers/enable-errors";
import type { TAutomationEnableErrors } from "../helpers/enable-errors";
import { useAutomationDetails, useAutomationMetadata } from "../helpers/metadata";
import { isScheduleConfig } from "../helpers/trigger-config";
import { AutomationActionsBlock } from "./actions-block";
import { ensureConditionIds } from "./condition-builder";
import { AutomationConditionSection } from "./condition-section";
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

type TUpdateAutomation = IAutomationStore["updateAutomation"];

/**
 * Debounced writer for the auto-saving blocks. Everything it needs arrives per
 * call, so it holds no stale closure over component state.
 */
const makePersist = () =>
  debounce(
    (
      slug: string,
      project: string | undefined,
      id: string,
      payload: Parameters<TUpdateAutomation>[2],
      update: TUpdateAutomation,
      onError: (error: unknown) => void,
      onSaved?: () => void
    ) => {
      update(slug, id, payload, project).then(onSaved, onError);
    },
    CONDITION_SAVE_DELAY_MS
  );

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
  // An enabled automation refuses an incomplete schedule. The reason is shown on the trigger card.
  const [scheduleRejection, setScheduleRejection] = useState<string | null>(null);
  const [enableErrors, setEnableErrors] = useState<TAutomationEnableErrors | null>(null);
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    // Hydrate once per automation, so in-flight local edits are never clobbered
    // by the store update that our own PATCH triggers.
    if (!automation || hydratedFor.current === automation.id) return;
    hydratedFor.current = automation.id;
    setCondition(ensureConditionIds(automation.condition));
    setScheduleConfig(isScheduleConfig(automation.trigger_config) ? automation.trigger_config : { mode: "fixed" });
  }, [automation]);

  const reportError = useCallback(
    (error: unknown) => {
      const body = getApiErrorBody(error);
      const firstDetail = isObject(body) ? Object.values(body).flat().find(isString) : undefined;
      setToast({
        type: "error",
        title: t("automations.toasts.update.error.title"),
        message: firstDetail ?? t("automations.toasts.update.error.message"),
      });
    },
    [t]
  );

  // useRef has no lazy-initializer form, so build the debounced writer once
  // instead of allocating and discarding one on every render.
  const persistRef = useRef<ReturnType<typeof makePersist> | null>(null);
  if (persistRef.current === null) persistRef.current = makePersist();
  const persist = persistRef.current;

  // Send the last pending edit rather than dropping it when the page unmounts.
  useEffect(() => () => persist.flush(), [persist]);

  const handleConditionChange = (next: TAutomationConditionNode | null) => {
    setCondition(next);
    persist(workspaceSlug, projectId, automationId, { condition: next }, updateAutomation, reportError);
  };

  const handleScheduleError = (error: unknown) => {
    const message = getFirstStringField(getApiErrorBody(error), "trigger_config");
    if (message) setScheduleRejection(message);
    else reportError(error);
  };

  const handleScheduleChange = (next: TAutomationScheduleConfig) => {
    setScheduleConfig(next);
    setEnableErrors((current) => current && { ...current, trigger: undefined });
    persist(
      workspaceSlug,
      projectId,
      automationId,
      { trigger_config: next },
      updateAutomation,
      handleScheduleError,
      () => setScheduleRejection(null)
    );
  };

  const handleActionEdited = (actionId: string) =>
    setEnableErrors((current) => {
      if (!current?.actions[actionId]) return current;
      const { [actionId]: _resolved, ...actions } = current.actions;
      return { ...current, actions };
    });

  const handleScopeChange = async (payload: { applies_to_all_projects?: boolean; project_ids?: string[] }) => {
    try {
      await updateAutomation(workspaceSlug, automationId, payload, projectId);
    } catch (error) {
      reportError(error);
    }
  };

  const handleTriggerChange = async (triggerType: TAutomationTriggerType) => {
    try {
      await updateAutomation(workspaceSlug, automationId, { trigger_type: triggerType }, projectId);
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
      setEnableErrors(null);
      setToast({
        type: "success",
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
      const errors = parseEnableErrors(getApiErrorBody(error));
      setEnableErrors(errors);
      setToast({
        type: "error",
        title: t("automations.toasts.enable.error.title"),
        message: describeEnableErrors(errors) ?? t("automations.enable.validation.required"),
      });
    } finally {
      setIsTogglingEnabled(false);
    }
  };

  const handleRunNow = async () => {
    try {
      await runNow(workspaceSlug, automationId, projectId);
      setToast({
        type: "success",
        title: t("automations.toasts.run_now.success.title"),
        message: t("automations.toasts.run_now.success.message"),
      });
    } catch (error) {
      setToast({
        type: "error",
        title: t("automations.toasts.run_now.error.title"),
        message: readString(getApiErrorBody(error), "error") ?? t("automations.toasts.run_now.error.message"),
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
            <Button
              variant="secondary"
              size="md"
              icon={<Play />}
              onClick={handleRunNow}
              disabled={disabled}
              stretch="auto"
              label={t("automations.designer.run_now")}
            />
          )}
          <div className="flex items-center gap-2">
            <span className="text-13 text-secondary">
              {t(automation.is_enabled ? "automations.designer.enabled" : "automations.designer.disabled")}
            </span>
            <Switch
              checked={automation.is_enabled}
              onCheckedChange={handleToggleEnabled}
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
        error={scheduleRejection ?? enableErrors?.trigger ?? automation.trigger_config_error}
        disabled={disabled}
      />

      <AutomationConditionSection
        projectId={projectId}
        automation={automation}
        metadata={metadata}
        condition={condition}
        onChange={handleConditionChange}
        disabled={disabled}
      />

      <AutomationActionsBlock
        key={automation.id}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        automation={automation}
        metadata={metadata}
        disabled={disabled}
        enableErrors={enableErrors?.actions}
        onActionEdited={handleActionEdited}
      />

      <AutomationRunHistory workspaceSlug={workspaceSlug} projectId={projectId} automationId={automationId} />
    </div>
  );
});
