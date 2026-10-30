/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useId } from "react";
import { X } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import type { TPqlDialect, TWorkItemQueryField, TWorkItemQueryFields } from "@plane/types";

type Props = {
  fields: TWorkItemQueryFields | undefined;
  /** The dialect in effect, and the two settings it comes from. */
  dialect: TPqlDialect;
  workspaceDialect: TPqlDialect;
  memberDialect: TPqlDialect | null;
  /** Null follows the workspace's dialect. */
  onDialectChange: (dialect: TPqlDialect | null) => void;
  onClose: () => void;
};

const DIALECT_NAMES: Record<TPqlDialect, string> = { jql: "JQL", plane: "Plane" };

/** The member's choice in the select; "default" follows the workspace. */
type TDialectChoice = TPqlDialect | "default";

const EXAMPLES: { labelKey: string; query: Record<TPqlDialect, string> }[] = [
  {
    labelKey: "work_item_query.example_invoices",
    query: {
      jql: 'descendantOf("CUST-1") AND type = "Invoice" AND state = "Paid" AND due_date >= "2026-01-01" AND due_date < "2027-01-01"',
      plane:
        'descendantOf("CUST-1") AND type = "Invoice" AND state = "Paid" AND dueDate >= "2026-01-01" AND dueDate < "2027-01-01"',
    },
  },
  {
    labelKey: "work_item_query.example_everything",
    query: { jql: 'descendantOf("CUST-1")', plane: 'descendantOf("CUST-1")' },
  },
  {
    labelKey: "work_item_query.example_overdue",
    query: {
      jql: "state_group in (unstarted, started) AND due_date < now() - 1w",
      plane: "stateGroup in activeStates() AND dueDate < daysAgo(7)",
    },
  },
  {
    labelKey: "work_item_query.example_amount",
    query: {
      jql: 'cf["Amount"] > 1000 AND assignee = currentUser()',
      plane: 'cf["Amount"] > 1000 AND assignee = currentUser()',
    },
  },
];

const displayName = (field: TWorkItemQueryField, dialect: TPqlDialect) =>
  (dialect === "plane" ? field.plane_aliases[0] : undefined) ?? field.aliases[0] ?? field.name;

/** The cheat sheet under the query bar: syntax, fields, functions, examples. */
export function WorkItemQueryHelp(props: Props) {
  const { fields, dialect, workspaceDialect, memberDialect, onDialectChange, onClose } = props;
  const { t } = useTranslation();
  const dialectLabelId = useId();
  const dialectChoices: { value: TDialectChoice; label: string }[] = [
    { value: "default", label: t("work_item_query.dialect_default", { dialect: DIALECT_NAMES[workspaceDialect] }) },
    { value: "jql", label: DIALECT_NAMES.jql },
    { value: "plane", label: DIALECT_NAMES.plane },
  ];

  return (
    <div className="relative mt-1 grid gap-4 rounded-md border border-subtle-1 bg-layer-1 p-4 text-12 text-secondary md:grid-cols-2">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-2 grid size-6 place-items-center rounded-sm text-tertiary hover:bg-layer-2"
        aria-label={t("close")}
      >
        <X className="size-3.5" />
      </button>
      <div className="flex flex-col gap-2 md:col-span-2">
        <h4 className="text-13 font-medium text-primary">{t("work_item_query.help_title")}</h4>
        <p>{t("work_item_query.help_intro")}</p>
        <p className="font-code text-11">{t("work_item_query.help_operators")}</p>
        <div className="flex items-center gap-2">
          <span id={dialectLabelId}>{t("work_item_query.dialect")}</span>
          <Select<TDialectChoice>
            items={dialectChoices}
            value={memberDialect ?? "default"}
            onValueChange={(choice) => onDialectChange(choice === "default" || choice === null ? null : choice)}
          >
            <SelectTrigger size="md" aria-labelledby={dialectLabelId} />
            <SelectContent>
              <SelectList>
                {dialectChoices.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value} size="md" label={choice.label} />
                ))}
              </SelectList>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <h5 className="font-medium text-primary">{t("work_item_query.help_examples")}</h5>
        <ul className="flex flex-col gap-1.5">
          {EXAMPLES.map((example) => (
            <li key={example.labelKey} className="flex flex-col gap-0.5">
              <span>{t(example.labelKey)}</span>
              <code className="rounded-sm bg-layer-2 px-1.5 py-0.5 font-code text-11 break-all text-primary">
                {example.query[dialect]}
              </code>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1.5">
        <h5 className="font-medium text-primary">{t("work_item_query.help_fields")}</h5>
        {fields ? (
          <>
            <ul className="flex flex-wrap gap-1">
              {fields.fields.map((field) => (
                <li
                  key={field.name}
                  className="rounded-sm bg-layer-2 px-1.5 py-0.5 font-code text-11 text-primary"
                  title={[...field.aliases, ...field.plane_aliases, ...field.operators].join(", ")}
                >
                  {displayName(field, dialect)}
                </li>
              ))}
              <li className="rounded-sm bg-layer-2 px-1.5 py-0.5 font-code text-11 text-primary">
                {fields.custom_property_syntax}
              </li>
            </ul>
            <h5 className="mt-2 font-medium text-primary">{t("work_item_query.help_functions")}</h5>
            <ul className="flex flex-wrap gap-1">
              {fields.functions.map(({ name }) => (
                <li key={name} className="rounded-sm bg-layer-2 px-1.5 py-0.5 font-code text-11 text-primary">
                  {name}()
                </li>
              ))}
            </ul>
          </>
        ) : (
          <span className="text-tertiary">…</span>
        )}
      </div>
    </div>
  );
}
