/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useState } from "react";
import { observer } from "mobx-react";
import { Transition } from "@headlessui/react";
// plane imports
import { Button } from "@plane/propel/button";
import type { IFilterInstance } from "@plane/shared-state";
import type { TExternalFilter, TFilterProperty } from "@plane/types";

export type TFilterViewActionsProps<K extends TFilterProperty, E extends TExternalFilter> = {
  filter: IFilterInstance<K, E>;
  trackerElements?: {
    saveView?: string;
    updateView?: string;
  };
  className?: string;
  /** "sm" to line up with the small buttons of the query bar; the filter row keeps its default. */
  size?: "sm";
};

/**
 * "Save view" and "Update view" for a filter instance. They save everything that makes
 * up the view: the filter conditions and, through the save / update options, the
 * display filters, which include a query typed into the query bar. Rendered once per
 * view, wherever it is always visible.
 */
export const FilterViewActions = observer(function FilterViewActions<
  K extends TFilterProperty,
  E extends TExternalFilter,
>(props: TFilterViewActionsProps<K, E>) {
  const { filter, trackerElements, className, size } = props;
  // the filter row's buttons are default-sized with tighter padding
  const buttonProps = size ? { size } : { className: "py-1" };
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = useCallback(async () => {
    setIsUpdating(true);
    try {
      await filter.updateView();
    } finally {
      setTimeout(() => setIsUpdating(false), 240); // To avoid flickering
    }
  }, [filter]);

  if (!filter.configManager.areConfigsReady) return null;

  return (
    <div className={className ?? "flex items-center gap-2"}>
      <ElementTransition show={filter.canSaveView}>
        <Button
          variant="secondary"
          {...buttonProps}
          onClick={filter.saveView}
          data-ph-element={trackerElements?.saveView}
        >
          {filter.saveViewOptions?.label ?? "Save view"}
        </Button>
      </ElementTransition>
      <ElementTransition show={filter.canUpdateView}>
        <Button
          variant="secondary"
          {...buttonProps}
          onClick={() => void handleUpdate()}
          loading={isUpdating}
          disabled={isUpdating}
          data-ph-element={trackerElements?.updateView}
        >
          {isUpdating ? "Confirming" : (filter.updateViewOptions?.label ?? "Update view")}
        </Button>
      </ElementTransition>
    </div>
  );
});

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
