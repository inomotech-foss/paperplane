/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
// plane imports
import { Select } from "@plane/blocks/select";
import { cn } from "@plane/utils";

export type TAutomationOption<V extends string = string> = {
  value: V;
  /** Row label, also the search text. */
  query: string;
  icon?: ReactNode;
};

type TCommonProps<V extends string> = {
  options: TAutomationOption<V>[];
  /** Trigger content. */
  label: ReactNode;
  disabled?: boolean;
  className?: string;
  showSearch?: boolean;
};

type TProps<V extends string> = TCommonProps<V> &
  (
    | { multiple?: false; value: V | null; onChange: (value: V) => void }
    | { multiple: true; value: V[]; onChange: (value: V[]) => void }
  );

/** Single or multi select over a flat `{ value, query }` option list. */
export function AutomationOptionSelect<V extends string>(props: TProps<V>) {
  const { options, label, disabled, className, showSearch = true } = props;

  const shared = {
    getValues: () => options,
    getOptionValue: (option: TAutomationOption<V>) => option.value,
    getOptionLabel: (option: TAutomationOption<V>) => option.query,
    getOptionIcon: (option: TAutomationOption<V>) => option.icon,
    getOptionPlaceholder: (id: string) => ({ value: id as V, query: id }),
    pinSelected: false,
    showSearch,
    disabled,
  };

  const trigger = (
    <Select.Trigger variant="select-md" disabled={disabled} className={cn("w-full", className)}>
      <span className="min-w-0 grow truncate text-left">{label}</span>
    </Select.Trigger>
  );

  if (props.multiple) {
    const { value, onChange } = props;
    return (
      <Select<TAutomationOption<V>> {...shared} multiple valueIds={value} onChange={(next) => onChange(next as V[])}>
        {trigger}
      </Select>
    );
  }

  const { value, onChange } = props;
  return (
    <Select<TAutomationOption<V>>
      {...shared}
      value={options.find((option) => option.value === value) ?? null}
      onChange={(next) => onChange(next as V)}
    >
      {trigger}
    </Select>
  );
}
