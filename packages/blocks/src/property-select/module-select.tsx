/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ModuleOutline } from "@makeplane/propel/icons";
import type { TPaginatedResponse } from "@plane/types";
import { Select } from "../select/select";
import type { SelectPaginationParams, SelectTooltip, SelectVariant } from "../select/types";
import { ProjectIdentifierElement } from "./shared/project-identifier-element";

/** Minimal module shape the dropdown needs — the client maps its richer record down to this. */
export type ModuleOption = {
  id: string;
  name: string;
  /** Owning project's short code, shown as a pill when `showIdentifier` is set. */
  identifier?: string;
};

type ModuleSelectBaseProps = {
  getValues: (params: SelectPaginationParams) => Promise<TPaginatedResponse<ModuleOption[]>>;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  onClose?: () => void;
  className?: string;
  /** Shows each option's `identifier` as a pill, for a picker scoped across several projects. */
  showIdentifier?: boolean;
  tooltip?: SelectTooltip;
  /** Tab order of the trigger, for forms that sequence focus explicitly (e.g. the work item create modal). */
  tabIndex?: number;
};

export type ModuleSelectProps =
  | (ModuleSelectBaseProps & {
      /** Multi-select: emits all selected ids on change. `variant` cannot be `"breadcrumb"`. */
      multiple: true;
      value: ModuleOption[];
      onChange: (ids: string[]) => void;
      variant: Exclude<SelectVariant, "breadcrumb">;
    })
  | (ModuleSelectBaseProps & {
      /** Single-select (default). Supports all variants including `"breadcrumb"`. */
      multiple?: false;
      value: ModuleOption | null;
      onChange: (id: string) => void;
      variant: SelectVariant;
    });

function triggerLabel(selected: ModuleOption[], showCountOnMultiple: boolean, placeholder?: string): string {
  if (selected.length === 0) return placeholder ?? "";
  if (selected.length === 1) return selected[0]?.name ?? "";
  if (showCountOnMultiple) return `${selected.length} modules`;
  return selected.map((module) => module.name).join(", ");
}

/**
 * Presentational, data-source-agnostic module picker.
 * Pass `multiple={true}` for multi-select (issue sidebar); omit or pass `multiple={false}` for
 * single-select (breadcrumb navigation, inline picker).
 */
export function ModuleSelect(props: ModuleSelectProps) {
  if (!props.multiple) {
    const {
      getValues,
      value,
      onChange,
      variant,
      disabled = false,
      placeholder = "",
      searchPlaceholder = "Search modules...",
      onClose,
      className,
      showIdentifier = false,
      tooltip,
      tabIndex,
    } = props;

    return (
      <Select<ModuleOption>
        infinite
        getValues={getValues}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        onClose={onClose}
        getOptionValue={(module) => module.id}
        getOptionLabel={(module) => module.name}
        getOptionIcon={() => <ModuleOutline className="size-4 shrink-0 text-primary" />}
        getOptionTrailing={
          showIdentifier
            ? (module) =>
                module.identifier ? <ProjectIdentifierElement show identifier={module.identifier} /> : undefined
            : undefined
        }
      >
        <Select.Trigger
          disabled={disabled}
          variant={variant}
          tabIndex={tabIndex}
          className={className}
          prependIcon={<ModuleOutline />}
          label={value?.name ?? placeholder}
          tooltip={tooltip}
        >
          {(!!value || !!placeholder) && (
            <span className="min-w-0 grow truncate text-left">{value?.name ?? placeholder}</span>
          )}
        </Select.Trigger>
      </Select>
    );
  }

  const {
    getValues,
    value,
    onChange,
    variant,
    disabled = false,
    placeholder = "",
    searchPlaceholder = "Search modules...",
    onClose,
    className,
    showIdentifier = false,
    tooltip,
    tabIndex,
  } = props;

  // "table-cell" / "pill" summarise as "N modules"; "select" / "select-ghost" list per-module pills instead.
  const showCountOnMultiple = variant === "table-cell" || variant.startsWith("pill-");
  const showPills = !showCountOnMultiple && value.length > 0;

  return (
    <Select<ModuleOption>
      infinite
      multiple
      getValues={getValues}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      onClose={onClose}
      getOptionValue={(module) => module.id}
      getOptionLabel={(module) => module.name}
      getOptionIcon={() => <ModuleOutline className="size-4 shrink-0 text-primary" />}
      getOptionTrailing={
        showIdentifier
          ? (module) =>
              module.identifier ? <ProjectIdentifierElement show identifier={module.identifier} /> : undefined
          : undefined
      }
    >
      <Select.Trigger
        disabled={disabled}
        variant={variant}
        tabIndex={tabIndex}
        className={className}
        prependIcon={showPills ? undefined : <ModuleOutline />}
        label={triggerLabel(value, showCountOnMultiple, placeholder)}
        tooltip={tooltip}
      >
        {showPills ? (
          <div className="flex min-w-0 grow flex-wrap items-center gap-1">
            {value.map((module) => (
              <span
                key={module.id}
                className="flex h-5 max-w-full items-center gap-1 rounded-sm bg-layer-3 px-1.5 text-caption-md-medium text-secondary"
              >
                <ModuleOutline className="size-3.5 shrink-0" />
                <span className="truncate">{module.name}</span>
              </span>
            ))}
          </div>
        ) : (
          (value.length > 0 || !!placeholder) && (
            <span className="min-w-0 grow truncate text-left">
              {triggerLabel(value, showCountOnMultiple, placeholder)}
            </span>
          )
        )}
      </Select.Trigger>
    </Select>
  );
}
