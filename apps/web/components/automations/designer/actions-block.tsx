/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { orderBy } from "lodash-es";
import { Plus, Trash2, Wand2 } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { setToast } from "@plane/blocks/toast";
import type {
  TAutomation,
  TAutomationAction,
  TAutomationActionConfig,
  TAutomationActionType,
  TAutomationMetadata,
} from "@plane/types";
// hooks
import { useAutomation } from "@/hooks/store/use-automation";
// local imports
import { allowedActions, findAction } from "../helpers/metadata";
import { AutomationActionConfig, actionNeedsConfig } from "./action-config";
import { RawAutomationValue } from "./raw-value";
import { getApiErrorBody } from "@/helpers/error.helper";
import { readString } from "@plane/types";
import { getFirstStringField } from "@/helpers/narrow.helper";
import { useActionDraft } from "./use-action-draft";

type Props = {
  workspaceSlug: string;
  /** Omitted for workspace-scoped rules. */
  projectId?: string;
  automation: TAutomation;
  metadata: TAutomationMetadata | undefined;
  disabled?: boolean;
};

/** Starting config for a freshly added action. It is kept locally until the user completes it. */
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
  actionType: TAutomationActionType;
  /** Undefined while the action only exists on this screen. */
  action: TAutomationAction | undefined;
  index: number;
  onCreated?: (actionId: string) => void;
  onDiscard?: () => void;
};

const ActionCard = observer(function ActionCard(props: ActionCardProps) {
  const { workspaceSlug, projectId, automation, metadata, actionType, action, index, disabled, onCreated, onDiscard } =
    props;
  const { t } = useTranslation();
  const { createAction, updateAction, deleteAction } = useAutomation();

  const definition = findAction(metadata, actionType);
  const draft = useActionDraft({
    savedId: action?.id,
    savedConfig: action?.config,
    initialConfig: initialConfigFor(actionType),
    create: async (config) => {
      const created = await createAction(workspaceSlug, automation.id, { action_type: actionType, config }, projectId);
      onCreated?.(created.id);
      return created.id;
    },
    update: async (id, config) => {
      await updateAction(workspaceSlug, automation.id, id, { config }, projectId);
    },
    describeError: (error) =>
      getFirstStringField(getApiErrorBody(error), "config") ?? t("automations.toasts.action.update.error.message"),
  });

  const handleDelete = async () => {
    // A create still in flight would bring the action back, so delete what it stores
    const actionId = action?.id ?? (await draft.settle());
    if (!actionId) {
      onDiscard?.();
      return;
    }
    try {
      await deleteAction(workspaceSlug, automation.id, actionId, projectId);
      onDiscard?.();
    } catch (error) {
      setToast({
        type: "error",
        title: t("common.errors.default.title"),
        message: readString(getApiErrorBody(error), "error") ?? t("automations.action.validation.delete_only_action"),
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
          <h4 className="text-body-sm-medium">{definition ? t(definition.i18n_label) : actionType}</h4>
          {draft.isSaving && <span className="text-11 text-tertiary">{t("common.loading")}</span>}
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

      {action?.raw_config === undefined ? (
        <AutomationActionConfig
          projectId={projectId}
          scope={automation.scope}
          metadata={metadata}
          actionType={actionType}
          config={draft.config}
          onChange={draft.change}
          disabled={disabled}
        />
      ) : (
        <RawAutomationValue value={action.raw_config} />
      )}
      {draft.error && (
        <p role="alert" className="mt-2 text-12 text-danger-primary">
          {draft.error}
        </p>
      )}
    </div>
  );
});

type TLocalAction = { key: string; actionType: TAutomationActionType; actionId?: string };

/**
 * The ordered list of actions. Each card persists its own configuration, so a
 * mistake in one action never blocks editing another.
 */
export const AutomationActionsBlock = observer(function AutomationActionsBlock(props: Props) {
  const { workspaceSlug, projectId, automation, metadata, disabled } = props;
  const { t } = useTranslation();
  const { createAction } = useAutomation();
  const [isAdding, setIsAdding] = useState(false);
  // Actions added on this screen, held until the server accepts their config
  const [localActions, setLocalActions] = useState<TLocalAction[]>([]);
  const nextLocalKey = useRef(0);

  const options = allowedActions(metadata, automation.trigger_type).map((action) => ({
    value: action.key,
    query: t(action.i18n_label),
  }));

  const handleAdd = async (actionType: TAutomationActionType) => {
    if (actionNeedsConfig(actionType)) {
      nextLocalKey.current += 1;
      const key = `local-${nextLocalKey.current}`;
      setLocalActions((current) => [...current, { key, actionType }]);
      return;
    }
    setIsAdding(true);
    try {
      await createAction(workspaceSlug, automation.id, { action_type: actionType, config: {} }, projectId);
    } catch (error) {
      setToast({
        type: "error",
        title: t("automations.toasts.action.create.error.title"),
        message:
          getFirstStringField(getApiErrorBody(error), "config") ?? t("automations.toasts.action.create.error.message"),
      });
    } finally {
      setIsAdding(false);
    }
  };

  const claim = (key: string, actionId: string) =>
    setLocalActions((current) => current.map((item) => (item.key === key ? { ...item, actionId } : item)));
  const discard = (key: string) => setLocalActions((current) => current.filter((item) => item.key !== key));

  const localKeyById = new Map(localActions.map((item) => [item.actionId, item]));
  const cards = [
    ...orderBy(automation.actions, "sort_order").map((action) => {
      const local = localKeyById.get(action.id);
      return { key: local?.key ?? action.id, actionType: action.action_type, action, local };
    }),
    ...localActions
      .filter((local) => !local.actionId)
      .map((local) => ({ key: local.key, actionType: local.actionType, action: undefined, local })),
  ];

  return (
    <section className="rounded-lg border border-subtle bg-layer-2 p-4">
      <header className="mb-3 flex items-center gap-2">
        <div className="grid size-7 shrink-0 place-items-center rounded-sm bg-layer-3">
          <Wand2 className="size-4 text-accent-primary" />
        </div>
        <h3 className="text-body-sm-semibold">{t("automations.action.sidebar_header")}</h3>
      </header>

      <div className="flex flex-col gap-3">
        {cards.map((card, index) => (
          <ActionCard
            key={card.key}
            {...props}
            actionType={card.actionType}
            action={card.action}
            index={index}
            onCreated={card.local ? (actionId) => claim(card.key, actionId) : undefined}
            onDiscard={card.local ? () => discard(card.key) : undefined}
          />
        ))}

        {!automation.trigger_type ? (
          <p className="text-13 text-tertiary">{t("automations.action.trigger_required")}</p>
        ) : (
          <Menu>
            <MenuTrigger
              disabled={disabled || isAdding}
              render={
                <Button
                  variant="secondary"
                  size="md"
                  stretch="auto"
                  icon={<Icon icon={Plus} />}
                  disabled={disabled || isAdding}
                  label={t("automations.action.add_action")}
                />
              }
            />
            <MenuContent side="bottom" align="start">
              {options.map((option) => (
                <MenuItem key={option.value} label={option.query} onClick={() => void handleAdd(option.value)} />
              ))}
            </MenuContent>
          </Menu>
        )}
      </div>
    </section>
  );
});
