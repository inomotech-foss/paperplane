/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { orderBy } from "lodash-es";
import { Plus, Trash2, Wand2 } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type {
  TAutomation,
  TAutomationAction,
  TAutomationActionConfig,
  TAutomationActionType,
  TAutomationMetadata,
} from "@plane/types";
import { CustomSearchSelect } from "@plane/ui";
// hooks
import { useAutomation } from "@/hooks/store/use-automation";
// local imports
import { allowedActions, findAction } from "../helpers/metadata";
import { AutomationActionConfig } from "./action-config";

type Props = {
  workspaceSlug: string;
  /** Omitted for workspace-scoped rules. */
  projectId?: string;
  automation: TAutomation;
  metadata: TAutomationMetadata | undefined;
  disabled?: boolean;
};

/** Starting config for a freshly added action, so the form opens on a valid shape. */
const initialConfigFor = (actionType: TAutomationActionType): TAutomationActionConfig => {
  switch (actionType) {
    case "change_property":
      return { property: "", change_type: "set" };
    case "add_comment":
      return { comment_html: "" };
    case "send_notification":
      return { recipients: ["assignees"], title: "" };
    case "create_work_item":
      return { name: "" };
    case "call_webhook":
      return { url: "", method: "POST" };
    default:
      return {};
  }
};

type ActionCardProps = Props & {
  action: TAutomationAction;
  index: number;
};

const ActionCard = observer(function ActionCard(props: ActionCardProps) {
  const { workspaceSlug, projectId, automation, metadata, action, index, disabled } = props;
  const { t } = useTranslation();
  const { updateAction, deleteAction } = useAutomation();
  const [isSaving, setIsSaving] = useState(false);

  const definition = findAction(metadata, action.action_type);

  const handleConfigChange = async (config: TAutomationActionConfig) => {
    setIsSaving(true);
    try {
      await updateAction(workspaceSlug, automation.id, action.id, { config }, projectId);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("automations.toasts.action.update.error.title"),
        message: (error as { config?: string })?.config ?? t("automations.toasts.action.update.error.message"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAction(workspaceSlug, automation.id, action.id, projectId);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.errors.default.title"),
        message: (error as { error?: string })?.error ?? t("automations.action.validation.delete_only_action"),
      });
    }
  };

  return (
    <div className="rounded-md border border-subtle bg-layer-2 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-layer-3 text-11 font-medium text-secondary">
            {index + 1}
          </span>
          <h4 className="text-body-sm-medium">{definition ? t(definition.i18n_label) : action.action_type}</h4>
          {isSaving && <span className="text-11 text-tertiary">{t("common.loading")}</span>}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={disabled}
          aria-label={t("automations.designer.remove_action")}
          className="shrink-0 rounded-sm p-1 text-tertiary hover:bg-layer-1 hover:text-danger-primary disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <AutomationActionConfig
        projectId={projectId}
        scope={automation.scope}
        metadata={metadata}
        actionType={action.action_type}
        config={action.config}
        onChange={handleConfigChange}
        disabled={disabled}
      />
    </div>
  );
});

/**
 * The ordered list of actions. Each card persists its own configuration, so a
 * mistake in one action never blocks editing another.
 */
export const AutomationActionsBlock = observer(function AutomationActionsBlock(props: Props) {
  const { workspaceSlug, projectId, automation, metadata, disabled } = props;
  const { t } = useTranslation();
  const { createAction } = useAutomation();
  const [isAdding, setIsAdding] = useState(false);

  const options = allowedActions(metadata, automation.trigger_type).map((action) => ({
    value: action.key,
    query: t(action.i18n_label),
    content: <span className="truncate">{t(action.i18n_label)}</span>,
  }));

  const handleAdd = async (actionType: TAutomationActionType) => {
    setIsAdding(true);
    try {
      await createAction(
        workspaceSlug,
        automation.id,
        { action_type: actionType, config: initialConfigFor(actionType) },
        projectId
      );
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("automations.toasts.action.create.error.title"),
        message: (error as { config?: string })?.config ?? t("automations.toasts.action.create.error.message"),
      });
    } finally {
      setIsAdding(false);
    }
  };

  const actions = orderBy(automation.actions, "sort_order");

  return (
    <section className="rounded-lg border border-subtle bg-layer-2 p-4">
      <header className="mb-3 flex items-center gap-2">
        <div className="grid size-7 shrink-0 place-items-center rounded-sm bg-layer-3">
          <Wand2 className="size-4 text-accent-primary" />
        </div>
        <h3 className="text-body-sm-semibold">{t("automations.action.sidebar_header")}</h3>
      </header>

      <div className="flex flex-col gap-3">
        {actions.map((action, index) => (
          <ActionCard key={action.id} {...props} action={action} index={index} />
        ))}

        {!automation.trigger_type ? (
          <p className="text-13 text-tertiary">{t("automations.trigger.input_label")}</p>
        ) : (
          <CustomSearchSelect
            value={null}
            options={options}
            onChange={handleAdd}
            disabled={disabled || isAdding}
            customButton={
              <Button variant="secondary" size="lg" prependIcon={<Plus />} disabled={disabled || isAdding}>
                {t("automations.action.add_action")}
              </Button>
            }
          />
        )}
      </div>
    </section>
  );
});
