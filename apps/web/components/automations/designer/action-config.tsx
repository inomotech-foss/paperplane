/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import type {
  TAddCommentConfig,
  TAutomationActionConfig,
  TAutomationActionType,
  TAutomationChangeType,
  TAutomationDateValue,
  TAutomationMetadata,
  TAutomationMutablePropertyDefinition,
  TCallWebhookConfig,
  TChangePropertyConfig,
  TAutomationScope,
  TCreateWorkItemConfig,
  TSendNotificationConfig,
} from "@plane/types";
import { Switch } from "@makeplane/propel/components/switch";
// components
import { IssueTypeDropdown } from "@/components/dropdowns/issue-type";
// hooks
import { usePreselectedIssueTypeId } from "@/hooks/use-preselected-issue-type";
// local imports
import { AutomationOptionSelect } from "../helpers/option-select";
import { changeTypeLabelKey, findMutableProperty, usableMutableProperties } from "../helpers/metadata";
import { AutomationValueInput } from "./value-input";

type ConfigProps = {
  /** Omitted for workspace-scoped rules, which have no single project. */
  projectId?: string;
  scope: TAutomationScope;
  metadata: TAutomationMetadata | undefined;
  actionType: TAutomationActionType;
  config: TAutomationActionConfig;
  onChange: (config: TAutomationActionConfig) => void;
  disabled?: boolean;
};

const FieldLabel = (props: { children: React.ReactNode }) => (
  <span className="mb-1.5 block text-13 font-medium text-secondary">{props.children}</span>
);

/** Lists the `{{variable}}` names the server will substitute. */
const TemplateVariableHint = observer(function TemplateVariableHint(props: {
  metadata: TAutomationMetadata | undefined;
}) {
  const { metadata } = props;
  const { t } = useTranslation();
  const variables = metadata?.template_variables ?? [];
  if (variables.length === 0) return null;

  return (
    <details className="rounded-md border border-subtle bg-surface-2 px-3 py-2">
      <summary className="cursor-pointer text-12 font-medium text-secondary">
        {t("automations.designer.template_variables_label")}
      </summary>
      <p className="mt-1.5 text-11 text-tertiary">{t("automations.designer.template_variables_hint")}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {variables.map((variable) => (
          <code key={variable} className="font-mono rounded-sm bg-layer-3 px-1.5 py-0.5 text-11 text-secondary">
            {`{{${variable}}}`}
          </code>
        ))}
      </div>
    </details>
  );
});

type TChangeValueProps = {
  typed: TChangePropertyConfig;
  onChange: (config: TAutomationActionConfig) => void;
  disabled?: boolean;
};

/** `shift_days`: move a date by a number of days. */
function ShiftDaysInput(props: TChangeValueProps) {
  const { typed, onChange, disabled } = props;
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <div className="w-24">
        <InputGroup size="md">
          <Input
            type="number"
            value={typeof typed.value === "number" ? String(typed.value) : ""}
            onChange={(event) =>
              onChange({ ...typed, value: event.target.value === "" ? undefined : Number(event.target.value) })
            }
            disabled={disabled}
            size="md"
          />
        </InputGroup>
      </div>
      <span className="text-13 text-tertiary">{t("automations.operator_suffix.days")}</span>
    </div>
  );
}

const isRelativeDate = (value: TAutomationDateValue | undefined): value is Exclude<TAutomationDateValue, string> =>
  typeof value === "object" && value !== null && value.mode === "relative";

/** A date property: either an absolute date or a number of days from the run. */
function DateValueEditor(props: TChangeValueProps) {
  const { typed, onChange, disabled } = props;
  const { t } = useTranslation();
  const dateValue = typed.value as TAutomationDateValue | undefined;
  const relativeMode = isRelativeDate(dateValue);
  const modeLabelKey = relativeMode
    ? "automations.action.configuration.relative_date.mode_relative"
    : "automations.action.configuration.relative_date.mode_absolute";

  return (
    <div className="flex flex-col gap-2">
      <AutomationOptionSelect
        value={relativeMode ? "relative" : "absolute"}
        options={[
          {
            value: "absolute",
            query: t("automations.action.configuration.relative_date.mode_absolute"),
          },
          {
            value: "relative",
            query: t("automations.action.configuration.relative_date.mode_relative"),
          },
        ]}
        onChange={(mode: string) =>
          onChange({ ...typed, value: mode === "relative" ? { mode: "relative", days: 0 } : "" })
        }
        disabled={disabled}
        className="w-full"
        label={t(modeLabelKey)}
      />
      {relativeMode ? (
        <div className="flex items-center gap-2">
          <div className="w-24">
            <InputGroup size="md">
              <Input
                type="number"
                value={String(dateValue.days ?? 0)}
                onChange={(event) =>
                  onChange({ ...typed, value: { mode: "relative", days: Number(event.target.value) } })
                }
                disabled={disabled}
                size="md"
              />
            </InputGroup>
          </div>
          <span className="text-13 text-tertiary">
            {t("automations.action.configuration.relative_date.days_label")}
          </span>
        </div>
      ) : (
        <InputGroup size="md">
          <Input
            type="date"
            value={typeof dateValue === "string" ? dateValue : ""}
            onChange={(event) => onChange({ ...typed, value: event.target.value })}
            disabled={disabled}
            size="md"
          />
        </InputGroup>
      )}
    </div>
  );
}

/** The value editor below the property and change-type pickers. */
function ChangePropertyValueEditor(
  props: TChangeValueProps & {
    projectId?: string;
    definition: TAutomationMutablePropertyDefinition;
    changeType: TAutomationChangeType;
  }
) {
  const { projectId, definition, changeType, typed, onChange, disabled } = props;
  if (changeType === "shift_days") return <ShiftDaysInput typed={typed} onChange={onChange} disabled={disabled} />;
  if (definition.kind === "date") return <DateValueEditor typed={typed} onChange={onChange} disabled={disabled} />;
  return (
    <AutomationValueInput
      projectId={projectId}
      kind={definition.kind}
      source={definition.source}
      multiple={definition.kind === "multi_option"}
      value={typed.value}
      onChange={(value) => onChange({ ...typed, value: value as TChangePropertyConfig["value"] })}
      disabled={disabled}
    />
  );
}

/** `change_property` — pick a property, how to change it, and the new value. */
const ChangePropertyConfig = observer(function ChangePropertyConfig(props: ConfigProps) {
  const { projectId, scope, metadata, config, onChange, disabled } = props;
  const { t } = useTranslation();
  const typed = config as TChangePropertyConfig;

  const properties = usableMutableProperties(metadata, scope);
  const definition = findMutableProperty(metadata, typed.property);
  const changeType = typed.change_type ?? "set";
  const propertyPlaceholder = t("automations.action.configuration.change_property.placeholders.property_name");

  const handlePropertyChange = (propertyKey: string) => {
    const nextDefinition = findMutableProperty(metadata, propertyKey);
    const nextChangeType = (nextDefinition?.change_types[0] ?? "set") as TAutomationChangeType;
    onChange({ property: propertyKey, change_type: nextChangeType, value: undefined });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-44 flex-1">
          <FieldLabel>{propertyPlaceholder}</FieldLabel>
          <AutomationOptionSelect
            value={typed.property || null}
            options={properties.map((property) => ({
              value: property.key,
              query: t(property.i18n_label),
            }))}
            onChange={handlePropertyChange}
            disabled={disabled}
            className="w-full"
            label={
              definition ? (
                <span className="truncate">{t(definition.i18n_label)}</span>
              ) : (
                <span className="text-tertiary">{propertyPlaceholder}</span>
              )
            }
          />
        </div>

        <div className="min-w-36 flex-1">
          <FieldLabel>{t("automations.action.configuration.change_property.placeholders.change_type")}</FieldLabel>
          <AutomationOptionSelect
            value={changeType}
            options={(definition?.change_types ?? []).map((option) => ({
              value: option,
              query: t(changeTypeLabelKey(option)),
            }))}
            onChange={(value: TAutomationChangeType) =>
              onChange({ ...typed, change_type: value, value: value === "clear" ? undefined : typed.value })
            }
            disabled={disabled || !definition}
            className="w-full"
            label={t(changeTypeLabelKey(changeType))}
          />
        </div>
      </div>

      {definition && changeType !== "clear" && (
        <div className="max-w-md">
          <FieldLabel>{t("automations.action.configuration.label")}</FieldLabel>
          <ChangePropertyValueEditor
            projectId={projectId}
            definition={definition}
            changeType={changeType}
            typed={typed}
            onChange={onChange}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
});

/** `add_comment` — a rich-text-free template; variables are substituted server side. */
const AddCommentConfig = observer(function AddCommentConfig(props: ConfigProps) {
  const { config, onChange, disabled, metadata } = props;
  const { t } = useTranslation();
  const typed = config as TAddCommentConfig;

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={typed.comment_html ?? ""}
        onChange={(event) => onChange({ comment_html: event.target.value })}
        disabled={disabled}
        rows={4}
        placeholder={t("automations.action.configuration.add_comment.placeholder")}
        className="placeholder-tertiary w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-3 py-2 text-13 focus:outline-none"
      />
      <TemplateVariableHint metadata={metadata} />
    </div>
  );
});

/** `send_notification` — recipients plus the copy they receive. */
const SendNotificationConfig = observer(function SendNotificationConfig(props: ConfigProps) {
  const { projectId, metadata, config, onChange, disabled } = props;
  const { t } = useTranslation();
  const typed = config as TSendNotificationConfig;
  const recipients = typed.recipients ?? [];
  // Set membership, so the button loop below doesn't rescan the list per item.
  const selectedRecipients = new Set(recipients);

  const toggleRecipient = (group: TSendNotificationConfig["recipients"][number]) => {
    const next = recipients.includes(group) ? recipients.filter((value) => value !== group) : [...recipients, group];
    onChange({ ...typed, recipients: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <FieldLabel>{t("automations.action.configuration.send_notification.recipients_label")}</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {(metadata?.notification_recipients ?? []).map((group) => {
            const selected = selectedRecipients.has(group);
            return (
              <button
                key={group}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => toggleRecipient(group)}
                className={`rounded-sm border px-2.5 py-1 text-12 font-medium disabled:opacity-50 ${
                  selected
                    ? "border-accent-strong bg-accent-subtle text-accent-primary"
                    : "border-subtle bg-layer-2 text-secondary hover:bg-layer-1"
                }`}
              >
                {t(`automations.recipients.${group}`)}
              </button>
            );
          })}
        </div>
      </div>

      {recipients.includes("specific_members") && (
        <div className="max-w-md">
          <FieldLabel>{t("automations.action.configuration.send_notification.members_placeholder")}</FieldLabel>
          <AutomationValueInput
            projectId={projectId}
            kind="multi_option"
            source="members"
            multiple
            value={typed.member_ids ?? []}
            onChange={(value) => onChange({ ...typed, member_ids: value as string[] })}
            disabled={disabled}
          />
        </div>
      )}

      <div className="max-w-md">
        <FieldLabel>{t("automations.action.configuration.send_notification.title_label")}</FieldLabel>
        <InputGroup size="md">
          <Input
            type="text"
            value={typed.title ?? ""}
            onChange={(event) => onChange({ ...typed, title: event.target.value })}
            placeholder={t("automations.action.configuration.send_notification.title_placeholder")}
            disabled={disabled}
            size="md"
          />
        </InputGroup>
      </div>

      <div className="max-w-md">
        <FieldLabel>{t("automations.action.configuration.send_notification.message_label")}</FieldLabel>
        <textarea
          value={typed.message ?? ""}
          onChange={(event) => onChange({ ...typed, message: event.target.value })}
          disabled={disabled}
          rows={3}
          placeholder={t("automations.action.configuration.send_notification.message_placeholder")}
          className="placeholder-tertiary w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-3 py-2 text-13 focus:outline-none"
        />
      </div>
      <TemplateVariableHint metadata={metadata} />
    </div>
  );
});

type TCreateFieldProps = {
  typed: TCreateWorkItemConfig;
  onChange: (config: TAutomationActionConfig) => void;
  disabled?: boolean;
};

/** Workspace rules only: the project the new work item is created in. */
function CreateWorkItemProjectField(props: TCreateFieldProps) {
  const { typed, onChange, disabled } = props;
  const { t } = useTranslation();
  return (
    <div className="max-w-md">
      <FieldLabel>{t("automations.action.configuration.create_work_item.project_label")}</FieldLabel>
      <AutomationValueInput
        kind="option"
        source="projects"
        multiple={false}
        value={typed.project_id ?? null}
        onChange={(value) =>
          // Changing project invalidates any state/assignee/label already chosen.
          onChange({
            ...typed,
            project_id: (value as string) ?? undefined,
            type_id: undefined,
            state_id: undefined,
            assignee_ids: [],
            label_ids: [],
          })
        }
        disabled={disabled}
      />
      <p className="mt-1 text-11 text-tertiary">
        {t("automations.action.configuration.create_work_item.project_hint")}
      </p>
    </div>
  );
}

function CreateWorkItemTextFields(props: TCreateFieldProps) {
  const { typed, onChange, disabled } = props;
  const { t } = useTranslation();
  return (
    <>
      <div className="max-w-md">
        <FieldLabel>{t("automations.action.configuration.create_work_item.name_label")}</FieldLabel>
        <InputGroup size="md">
          <Input
            type="text"
            value={typed.name ?? ""}
            onChange={(event) => onChange({ ...typed, name: event.target.value })}
            placeholder={t("automations.action.configuration.create_work_item.name_placeholder")}
            disabled={disabled}
            size="md"
          />
        </InputGroup>
      </div>

      <div className="max-w-md">
        <FieldLabel>{t("automations.action.configuration.create_work_item.description_label")}</FieldLabel>
        <textarea
          value={typed.description_html ?? ""}
          onChange={(event) => onChange({ ...typed, description_html: event.target.value })}
          disabled={disabled}
          rows={3}
          placeholder={t("automations.action.configuration.create_work_item.description_placeholder")}
          className="placeholder-tertiary w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-3 py-2 text-13 focus:outline-none"
        />
      </div>
    </>
  );
}

/** The type of the new work item, one of the target project's types. */
const CreateWorkItemTypeField = observer(function CreateWorkItemTypeField(
  props: TCreateFieldProps & { targetProjectId?: string }
) {
  const { typed, onChange, disabled, targetProjectId } = props;
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  // loads the project's types for the picker
  usePreselectedIssueTypeId(workspaceSlug?.toString(), targetProjectId);
  return (
    <div className="max-w-md">
      <FieldLabel>{t("automations.action.configuration.create_work_item.type_label")}</FieldLabel>
      {targetProjectId ? (
        <IssueTypeDropdown
          projectId={targetProjectId}
          value={typed.type_id}
          onChange={(value) => onChange({ ...typed, type_id: value })}
          disabled={disabled}
          variant="select-md"
          className="w-full"
        />
      ) : (
        <p className="text-11 text-tertiary">{t("automations.action.configuration.create_work_item.type_hint")}</p>
      )}
    </div>
  );
});

/** State, priority, assignee and label pickers. */
function CreateWorkItemPickers(props: TCreateFieldProps & { targetProjectId?: string }) {
  const { typed, onChange, disabled, targetProjectId } = props;
  const { t } = useTranslation();
  // Project-local values need a project to pick from.
  const canPickProjectLocalValues = !!targetProjectId;
  return (
    <>
      <div className="flex flex-wrap gap-3">
        {canPickProjectLocalValues && (
          <div className="min-w-44 flex-1">
            <FieldLabel>{t("automations.action.configuration.create_work_item.state_label")}</FieldLabel>
            <AutomationValueInput
              projectId={targetProjectId}
              kind="option"
              source="states"
              multiple={false}
              value={typed.state_id ?? null}
              onChange={(value) => onChange({ ...typed, state_id: (value as string) ?? undefined })}
              disabled={disabled}
            />
          </div>
        )}
        <div className="min-w-44 flex-1">
          <FieldLabel>{t("automations.action.configuration.create_work_item.priority_label")}</FieldLabel>
          <AutomationValueInput
            kind="option"
            source="priorities"
            multiple={false}
            value={typed.priority ?? null}
            onChange={(value) => onChange({ ...typed, priority: (value as string) ?? undefined })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-44 flex-1">
          <FieldLabel>{t("automations.action.configuration.create_work_item.assignees_label")}</FieldLabel>
          <AutomationValueInput
            projectId={targetProjectId}
            kind="multi_option"
            source="members"
            multiple
            value={typed.assignee_ids ?? []}
            onChange={(value) => onChange({ ...typed, assignee_ids: value as string[] })}
            disabled={disabled}
          />
        </div>
        {canPickProjectLocalValues && (
          <div className="min-w-44 flex-1">
            <FieldLabel>{t("automations.action.configuration.create_work_item.labels_label")}</FieldLabel>
            <AutomationValueInput
              projectId={targetProjectId}
              kind="multi_option"
              source="labels"
              multiple
              value={typed.label_ids ?? []}
              onChange={(value) => onChange({ ...typed, label_ids: value as string[] })}
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </>
  );
}

function CreateWorkItemDueField(props: TCreateFieldProps) {
  const { typed, onChange, disabled } = props;
  const { t } = useTranslation();
  const dueValue = typed.target_date;
  const dueDays = typeof dueValue === "object" && dueValue !== null ? dueValue.days : undefined;
  return (
    <div className="max-w-44">
      <FieldLabel>{t("automations.action.configuration.create_work_item.due_in_days_label")}</FieldLabel>
      <InputGroup size="md">
        <Input
          type="number"
          min={0}
          value={dueDays === undefined ? "" : String(dueDays)}
          onChange={(event) =>
            onChange({
              ...typed,
              target_date:
                event.target.value === "" ? undefined : { mode: "relative", days: Number(event.target.value) },
            })
          }
          disabled={disabled}
          size="md"
        />
      </InputGroup>
    </div>
  );
}

/** `create_work_item` — the template for the work item this rule opens. */
const CreateWorkItemConfig = observer(function CreateWorkItemConfig(props: ConfigProps) {
  const { projectId, scope, metadata, config, onChange, disabled } = props;
  const { t } = useTranslation();
  const typed = config as TCreateWorkItemConfig;
  const fieldProps = { typed, onChange, disabled };

  // A workspace rule has no implicit project, so the author picks one. Until they
  // do, the API creates the work item in whichever project the run is for, and
  // the state/assignee/label pickers stay hidden because their values are
  // project-local. A project rule always has its own project to fall back on.
  const targetProjectId = scope === "workspace" ? typed.project_id : (typed.project_id ?? projectId);

  return (
    <div className="flex flex-col gap-3">
      {scope === "workspace" && <CreateWorkItemProjectField {...fieldProps} />}
      <CreateWorkItemTextFields {...fieldProps} />
      <CreateWorkItemTypeField {...fieldProps} targetProjectId={targetProjectId} />
      <CreateWorkItemPickers {...fieldProps} targetProjectId={targetProjectId} />
      <CreateWorkItemDueField {...fieldProps} />

      <label className="flex items-center gap-2">
        <Switch
          checked={!!typed.link_to_trigger_work_item}
          onCheckedChange={(value) => onChange({ ...typed, link_to_trigger_work_item: value })}
          size="sm"
          disabled={disabled}
        />
        <span className="text-13 text-secondary">
          {t("automations.action.configuration.create_work_item.link_to_trigger_label")}
        </span>
      </label>

      <TemplateVariableHint metadata={metadata} />
    </div>
  );
});

/** `call_webhook` — an outbound request; the backend blocks internal targets. */
const CallWebhookConfig = observer(function CallWebhookConfig(props: ConfigProps) {
  const { config, onChange, disabled, metadata } = props;
  const { t } = useTranslation();
  const typed = config as TCallWebhookConfig;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-64 flex-1">
          <FieldLabel>{t("automations.action.configuration.call_webhook.url_label")}</FieldLabel>
          <InputGroup size="md">
            <Input
              type="url"
              value={typed.url ?? ""}
              onChange={(event) => onChange({ ...typed, url: event.target.value })}
              placeholder={t("automations.action.configuration.call_webhook.url_placeholder")}
              disabled={disabled}
              size="md"
            />
          </InputGroup>
        </div>
        <div className="w-32">
          <FieldLabel>{t("automations.action.configuration.call_webhook.method_label")}</FieldLabel>
          <AutomationOptionSelect
            value={typed.method ?? "POST"}
            options={(["POST", "PUT", "PATCH"] as const).map((method) => ({
              value: method,
              query: method,
            }))}
            onChange={(value: TCallWebhookConfig["method"]) => onChange({ ...typed, method: value })}
            disabled={disabled}
            className="w-full"
            label={typed.method ?? "POST"}
          />
        </div>
      </div>

      <div className="max-w-md">
        <FieldLabel>{t("automations.action.configuration.call_webhook.payload_label")}</FieldLabel>
        <textarea
          value={typed.payload ?? ""}
          onChange={(event) => onChange({ ...typed, payload: event.target.value })}
          disabled={disabled}
          rows={4}
          placeholder={t("automations.action.configuration.call_webhook.payload_placeholder")}
          className="font-mono placeholder-tertiary w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-3 py-2 text-12 focus:outline-none"
        />
      </div>
      <TemplateVariableHint metadata={metadata} />
    </div>
  );
});

const CONFIG_COMPONENTS: Partial<Record<TAutomationActionType, React.ComponentType<ConfigProps>>> = {
  change_property: ChangePropertyConfig,
  add_comment: AddCommentConfig,
  send_notification: SendNotificationConfig,
  create_work_item: CreateWorkItemConfig,
  call_webhook: CallWebhookConfig,
};

/** Renders the configuration form for whichever action type is selected. */
export const AutomationActionConfig = observer(function AutomationActionConfig(props: ConfigProps) {
  const { t } = useTranslation();
  const Component = CONFIG_COMPONENTS[props.actionType];

  if (!Component) {
    return (
      <p className="text-13 text-tertiary">{t("automations.action.configuration.archive_work_item.description")}</p>
    );
  }
  return <Component {...props} />;
});
