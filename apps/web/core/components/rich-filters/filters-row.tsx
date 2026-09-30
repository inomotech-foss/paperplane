/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { ListFilterPlus } from "lucide-react";
import { Transition } from "@headlessui/react";
// plane imports
import { Button } from "@plane/propel/button";
import type { IFilterInstance } from "@plane/shared-state";
import type { TExternalFilter, TFilterProperty } from "@plane/types";
import { cn, EHeaderVariant, Header, Loader } from "@plane/ui";
// local imports
import type { TAddFilterButtonProps } from "./add-filters/button";
import { AddFilterButton } from "./add-filters/button";
import { FilterItem } from "./filter-item/root";
import { FilterViewActions } from "./view-actions";

export type TFiltersRowProps<K extends TFilterProperty, E extends TExternalFilter> = {
  buttonConfig?: TAddFilterButtonProps<K, E>["buttonConfig"];
  disabledAllOperations?: boolean;
  filter: IFilterInstance<K, E>;
  variant?: "modal" | "header";
  trackerElements?: {
    clearFilter?: string;
    saveView?: string;
    updateView?: string;
  };
  /**
   * Leave "Save view" / "Update view" out of the row because the page shows them
   * elsewhere (next to the query bar), so they are there even when the row is hidden.
   */
  hideViewActions?: boolean;
};

export const FiltersRow = observer(function FiltersRow<K extends TFilterProperty, E extends TExternalFilter>(
  props: TFiltersRowProps<K, E>
) {
  const {
    buttonConfig,
    disabledAllOperations: disabledAllOperationsProp = false,
    filter,
    variant = "header",
    trackerElements,
    hideViewActions = false,
  } = props;
  // derived values
  const disabledAllOperations = disabledAllOperationsProp || !filter.configManager.areConfigsReady;
  const hasAnyConditions = filter.allConditionsForDisplay.length > 0;
  const hasAvailableOperations =
    !disabledAllOperations &&
    (filter.canClearFilters || (!hideViewActions && (filter.canSaveView || filter.canUpdateView)));

  const headerButtonConfig: Partial<TAddFilterButtonProps<K, E>["buttonConfig"]> = {
    label: null,
  };

  const modalButtonConfig: Partial<TAddFilterButtonProps<K, E>["buttonConfig"]> = {
    label: !hasAnyConditions ? "Filters" : null,
  };

  const leftContent = (
    <>
      {filter.allConditionsForDisplay.map((condition) => (
        <FilterItem key={condition.id} filter={filter} condition={condition} isDisabled={disabledAllOperations} />
      ))}
      <AddFilterButton
        filter={filter}
        buttonConfig={{
          label: null,
          ...(variant === "modal" ? modalButtonConfig : headerButtonConfig),
          size: "lg",
          iconConfig: {
            shouldShowIcon: true,
            iconComponent: ListFilterPlus,
          },
          ...buttonConfig,
          isDisabled: disabledAllOperations,
        }}
      />
    </>
  );

  const rightContent = !disabledAllOperations && (
    <>
      <ElementTransition show={filter.canClearFilters}>
        <Button
          variant="secondary"
          className={COMMON_OPERATION_BUTTON_CLASSNAME}
          onClick={filter.clearFilters}
          data-ph-element={trackerElements?.clearFilter}
        >
          {filter.clearFilterOptions?.label ?? "Clear all"}
        </Button>
      </ElementTransition>
      {!hideViewActions && <FilterViewActions filter={filter} trackerElements={trackerElements} />}
    </>
  );

  const mainContent = (
    <div className="flex w-full items-start gap-2 rounded-lg bg-layer-1 px-4 py-2">
      <div className="flex w-full flex-wrap items-center gap-2">{leftContent}</div>
      <div
        className={cn("flex items-center gap-2 border-l border-subtle pl-4", {
          "border-l-transparent pl-0": !hasAvailableOperations,
        })}
      >
        {rightContent}
      </div>
    </div>
  );

  const ModalVariant = (
    <div className="flex min-h-11 w-full flex-wrap items-center gap-2 rounded-lg bg-layer-1 p-2">{mainContent}</div>
  );

  const HeaderVariant = (
    <Header variant={EHeaderVariant.TERNARY} className="min-h-11 bg-surface-1 !px-3">
      {mainContent}
    </Header>
  );

  if (!filter.configManager.areConfigsReady && !hasAnyConditions) {
    return (
      <RowTransition show={filter.isVisible}>
        <Loader>
          <Loader.Item height="44px" width="100%" className={cn({ "rounded-none": variant === "header" })} />
        </Loader>
      </RowTransition>
    );
  }

  return <RowTransition show={filter.isVisible}>{variant === "modal" ? ModalVariant : HeaderVariant}</RowTransition>;
});

const COMMON_OPERATION_BUTTON_CLASSNAME = "py-1";

type TElementTransitionProps = {
  children: React.ReactNode;
  show: boolean;
};

const ElementTransition = observer(function ElementTransition(props: TElementTransitionProps) {
  return (
    <Transition
      show={props.show}
      enter="transition ease-out duration-200"
      enterFrom="opacity-0 scale-95"
      enterTo="opacity-100 scale-100"
      leave="transition ease-in duration-150"
      leaveFrom="opacity-100 scale-100"
      leaveTo="opacity-0 scale-95"
    >
      {props.children}
    </Transition>
  );
});

type TRowTransitionProps = {
  children: React.ReactNode;
  show: boolean;
};

const RowTransition = observer(function RowTransition(props: TRowTransitionProps) {
  return (
    <Transition
      show={props.show}
      enter="transition-all duration-150 ease-out"
      enterFrom="opacity-0 -translate-y-1"
      enterTo="opacity-100 translate-y-0"
      leave="transition-all duration-100 ease-in"
      leaveFrom="opacity-100 translate-y-0"
      leaveTo="opacity-0 -translate-y-1"
    >
      {props.children}
    </Transition>
  );
});
