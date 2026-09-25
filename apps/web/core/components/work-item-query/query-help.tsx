/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { X } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TWorkItemQueryFields } from "@plane/types";

type Props = {
  fields: TWorkItemQueryFields | undefined;
  onClose: () => void;
};

const EXAMPLES: { labelKey: string; query: string }[] = [
  {
    labelKey: "work_item_query.example_invoices",
    query:
      'descendantOf("CUST-1") AND type = "Invoice" AND state = "Paid" AND due_date >= "2026-01-01" AND due_date < "2027-01-01"',
  },
  { labelKey: "work_item_query.example_everything", query: 'descendantOf("CUST-1")' },
  {
    labelKey: "work_item_query.example_overdue",
    query: "state_group in (unstarted, started) AND due_date < now() - 1w",
  },
  { labelKey: "work_item_query.example_amount", query: 'cf["Amount"] > 1000 AND assignee = currentUser()' },
];

/** The cheat sheet under the query bar: syntax, fields, functions, examples. */
export function WorkItemQueryHelp(props: Props) {
  const { fields, onClose } = props;
  const { t } = useTranslation();

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
        <p className="font-mono text-11">{t("work_item_query.help_operators")}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <h5 className="font-medium text-primary">{t("work_item_query.help_examples")}</h5>
        <ul className="flex flex-col gap-1.5">
          {EXAMPLES.map((example) => (
            <li key={example.labelKey} className="flex flex-col gap-0.5">
              <span>{t(example.labelKey)}</span>
              <code className="font-mono rounded-sm bg-layer-2 px-1.5 py-0.5 text-11 break-all text-primary">
                {example.query}
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
                  className="font-mono rounded-sm bg-layer-2 px-1.5 py-0.5 text-11 text-primary"
                  title={[...field.aliases, ...field.lookups].join(", ")}
                >
                  {field.aliases[0] ?? field.name}
                </li>
              ))}
              <li className="font-mono rounded-sm bg-layer-2 px-1.5 py-0.5 text-11 text-primary">
                {fields.custom_property_syntax}
              </li>
            </ul>
            <h5 className="mt-2 font-medium text-primary">{t("work_item_query.help_functions")}</h5>
            <ul className="flex flex-wrap gap-1">
              {fields.functions.map((name) => (
                <li key={name} className="font-mono rounded-sm bg-layer-2 px-1.5 py-0.5 text-11 text-primary">
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
