// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useCallback, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import {
  AlertDialog,
  AlertDialogActions,
  AlertDialogBody,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogIntro,
  AlertDialogTitle,
} from "@makeplane/propel/components/alert-dialog";
import { Button } from "@makeplane/propel/components/button";
import { Select } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { ApiError } from "@plane/services";
import type { TIssueType } from "@plane/types";
// components
import { IssueTypeDropdown } from "@/components/dropdowns/issue-type";
// hooks
import { useIssueCustomProperties } from "@/hooks/store/use-issue-custom-properties";
import { useIssueTypes } from "@/hooks/store/use-issue-types";
// helpers
import { getCompatibleTargets, getUnmatchedOptions, isMappingComplete, toPropertyMapping } from "@/lib/type-migration";
import type { TPropertyDecision } from "@/lib/type-migration";
// services
import { countTypeReferences, IssueTypeMigrationService } from "@/services/issue/issue-type-migration.service";
import type {
  TTypeMigrationPreview,
  TTypeMigrationProperty,
  TTypeMigrationScope,
} from "@/services/issue/issue-type-migration.service";

const migrationService = new IssueTypeMigrationService();
const DROP = "__drop__";

type TChoice = { id: string; label: string };

function ChoiceSelect(props: {
  choices: TChoice[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const { choices, value, onChange, placeholder, ariaLabel } = props;
  const selected = choices.find((choice) => choice.id === value) ?? null;
  return (
    <Select<TChoice>
      getValues={() => choices}
      value={selected}
      onChange={(choiceId) => choiceId && onChange(choiceId)}
      getOptionValue={(choice) => choice.id}
      getOptionLabel={(choice) => choice.label}
      showSearch={false}
      pinSelected={false}
    >
      <Select.Trigger variant="select-md" className="w-full" aria-label={ariaLabel}>
        <span className="min-w-0 grow truncate text-left">{selected?.label ?? placeholder}</span>
      </Select.Trigger>
    </Select>
  );
}

/** Where the values of one property of the old type go: a compatible property of the new type, or nowhere. */
const PropertyMappingRow = observer(function PropertyMappingRow(props: {
  projectId: string;
  source: TTypeMigrationProperty;
  replacementTypeId: string;
  decision: TPropertyDecision | undefined;
  onDecide: (propertyId: string, decision: TPropertyDecision) => void;
}) {
  const { projectId, source, replacementTypeId, decision, onDecide } = props;
  const onChange = (next: TPropertyDecision) => onDecide(source.id, next);
  const { t } = useTranslation();
  const { getActiveProjectProperties, getPropertyById } = useIssueCustomProperties();
  const targets = getCompatibleTargets(source, getActiveProjectProperties(projectId) ?? [], replacementTypeId);
  const dropLabel = t("work_item_types.migration.drop_values");
  const target = decision?.kind === "target" ? getPropertyById(decision.targetId) : null;
  const unmatched = decision?.kind === "target" ? getUnmatchedOptions(source, target) : [];
  const optionChoices = [
    ...(target?.options ?? []).map((option) => ({ id: option.id, label: option.name })),
    { id: DROP, label: dropLabel },
  ];

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-subtle p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-13 font-medium text-primary">{source.name}</span>
        <span className="shrink-0 text-11 text-tertiary">
          {t("work_item_types.migration.values_count", { count: source.work_items })}
        </span>
      </div>
      <ChoiceSelect
        choices={[
          ...targets.map((property) => ({ id: property.id, label: property.display_name })),
          { id: DROP, label: dropLabel },
        ]}
        value={decision?.kind === "drop" ? DROP : decision?.targetId}
        onChange={(value) =>
          onChange(value === DROP ? { kind: "drop" } : { kind: "target", targetId: value, options: {} })
        }
        placeholder={t("work_item_types.migration.choose_target")}
        ariaLabel={source.name}
      />
      {decision?.kind === "target" &&
        unmatched.map((option) => (
          <div key={option.id} className="flex items-center gap-2 pl-3">
            <span className="w-1/3 shrink-0 truncate text-12 text-secondary">
              {t("work_item_types.migration.option_values", { name: option.name })}
            </span>
            <ChoiceSelect
              choices={optionChoices}
              value={option.id in decision.options ? (decision.options[option.id] ?? DROP) : undefined}
              onChange={(value) =>
                onChange({ ...decision, options: { ...decision.options, [option.id]: value === DROP ? null : value } })
              }
              placeholder={t("work_item_types.migration.choose_target")}
              ariaLabel={option.name}
            />
          </div>
        ))}
    </div>
  );
});

/** What the dialog says about the rows that still use the type. */
const useUsageMessage = (preview: TTypeMigrationPreview | undefined, unlink: boolean) => {
  const { t } = useTranslation();
  if (!unlink) return t("work_item_types.migration.change_description");
  const references = preview?.references;
  if (!references || countTypeReferences(references) === 0)
    return t("work_item_types.settings.item_delete_confirmation.description");
  if (references.work_items === 0) return t("work_item_types.settings.item_delete_confirmation.only_hidden");
  const inUse = t("work_item_types.settings.item_delete_confirmation.in_use", { count: references.work_items });
  return references.deleted_work_items > 0
    ? `${inUse} ${t("work_item_types.settings.item_delete_confirmation.deleted_too")}`
    : inUse;
};

type TIssueTypeMigrationDialogProps = {
  isOpen: boolean;
  workspaceSlug: string;
  projectId: string;
  fromType: TIssueType;
  scope: TTypeMigrationScope;
  /** Unlink the type from the project in the same request. */
  unlink?: boolean;
  /** The new type when it is already chosen, e.g. in a type dropdown. */
  replacementTypeId?: string;
  onClose: () => void;
};

/** The state of a migration: what it reaches, the choices made so far and whether it can run. */
const useTypeMigration = (props: TIssueTypeMigrationDialogProps) => {
  const { isOpen, workspaceSlug, projectId, fromType, scope, unlink = false, onClose } = props;
  const { t } = useTranslation();
  const { deleteIssueType, migrateIssueType } = useIssueTypes();
  const { getPropertyById } = useIssueCustomProperties();
  const [chosenTypeId, setChosenTypeId] = useState<string>();
  const [decisions, setDecisions] = useState<Record<string, TPropertyDecision | undefined>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // what the migration reaches, fetched each time the dialog opens
  const { data: preview } = useSWR(
    isOpen ? `ISSUE_TYPE_MIGRATION_${fromType.id}_${JSON.stringify(scope)}` : null,
    () =>
      unlink
        ? migrationService.getUsage(workspaceSlug, projectId, fromType.id)
        : migrationService.migrate(workspaceSlug, projectId, fromType.id, { scope, dry_run: true }),
    { revalidateOnFocus: false }
  );
  const replacementTypeId = props.replacementTypeId ?? chosenTypeId;
  const needsReplacement = !!preview && countTypeReferences(preview.references) > 0;
  const properties = needsReplacement && replacementTypeId ? (preview?.properties ?? []) : [];
  const isMapped = !!replacementTypeId && isMappingComplete(properties, decisions, getPropertyById);

  const reset = () => {
    setChosenTypeId(undefined);
    setDecisions({});
  };

  const decide = useCallback(
    (propertyId: string, decision: TPropertyDecision) =>
      setDecisions((previous) => ({ ...previous, [propertyId]: decision })),
    []
  );

  const chooseReplacement = (typeId: string) => {
    setChosenTypeId(typeId);
    // targets depend on the new type
    setDecisions({});
  };

  const close = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const submit = async () => {
    setIsSubmitting(true);
    try {
      if (unlink && !needsReplacement) await deleteIssueType(workspaceSlug, projectId, fromType.id);
      else
        await migrateIssueType(workspaceSlug, projectId, fromType.id, {
          scope,
          replacement_type_id: replacementTypeId,
          property_mapping: toPropertyMapping(decisions),
          remove_type: unlink ? "unlink" : undefined,
        });
      reset();
      onClose();
    } catch (error) {
      setToast({
        type: "error",
        title: t("common.error.label"),
        message: (error instanceof ApiError && error.error) || t("common.error.message"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    preview,
    replacementTypeId,
    needsReplacement,
    properties,
    decisions,
    isReady: !!preview && (!needsReplacement || isMapped),
    isSubmitting,
    decide,
    chooseReplacement,
    close,
    submit,
  };
};

/**
 * Moves work items to another type. Asks only for what the move needs: the new type while something uses
 * the old one, and a decision for each property value that has no place on the new type.
 */
export const IssueTypeMigrationDialog = observer(function IssueTypeMigrationDialog(
  props: TIssueTypeMigrationDialogProps
) {
  const { isOpen, projectId, fromType, unlink = false } = props;
  const { t } = useTranslation();
  const migration = useTypeMigration(props);
  const message = useUsageMessage(migration.preview, unlink);
  const askReplacement = migration.needsReplacement && !props.replacementTypeId;
  const replacementTypeId = migration.replacementTypeId;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && migration.close()}>
      <AlertDialogContent data-prevent-outside-click>
        <AlertDialogBody>
          <AlertDialogHeader>
            <AlertDialogIcon variant={unlink ? "danger" : "warning"} />
            <AlertDialogIntro>
              <AlertDialogTitle>
                {unlink
                  ? t("work_item_types.settings.item_delete_confirmation.title")
                  : t("work_item_types.migration.change_title")}
              </AlertDialogTitle>
              <AlertDialogDescription>{message}</AlertDialogDescription>
            </AlertDialogIntro>
          </AlertDialogHeader>
          {askReplacement && (
            <div className="mt-4 flex flex-col gap-1.5">
              <span className="text-13 font-medium text-secondary">
                {t("work_item_types.settings.item_delete_confirmation.replacement_label")}
              </span>
              <IssueTypeDropdown
                projectId={projectId}
                value={replacementTypeId}
                onChange={migration.chooseReplacement}
                filterTypes={(type) => type.id !== fromType.id && type.is_epic === fromType.is_epic}
                placeholder={t("work_item_types.migration.choose_type")}
                variant="select-md"
                className="w-full"
              />
            </div>
          )}
          {replacementTypeId && migration.properties.length > 0 && (
            <div className="mt-4 flex max-h-80 flex-col gap-2 overflow-y-auto">
              {migration.properties.map((source) => (
                <PropertyMappingRow
                  key={source.id}
                  projectId={projectId}
                  source={source}
                  replacementTypeId={replacementTypeId}
                  decision={migration.decisions[source.id]}
                  onDecide={migration.decide}
                />
              ))}
            </div>
          )}
        </AlertDialogBody>
        <AlertDialogActions>
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label={t("cancel")}
            disabled={migration.isSubmitting}
            render={<AlertDialogClose />}
          />
          <Button
            variant={unlink ? "danger" : "primary"}
            size="sm"
            stretch="auto"
            onClick={() => void migration.submit()}
            disabled={!migration.isReady}
            loading={migration.isSubmitting}
            label={unlink ? t("delete") : t("work_item_types.migration.confirm")}
          />
        </AlertDialogActions>
      </AlertDialogContent>
    </AlertDialog>
  );
});
