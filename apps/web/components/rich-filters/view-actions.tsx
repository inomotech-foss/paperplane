/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import type { IFilterInstance } from "@plane/shared-state";
import type { TExternalFilter, TFilterProperty } from "@plane/types";
// local imports
import { ElementTransition } from "./transition-components";

export type TFilterViewActionsProps<K extends TFilterProperty, E extends TExternalFilter> = {
  filter: IFilterInstance<K, E>;
  className?: string;
  /** Button size. */
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
  const { filter, className, size = "sm" } = props;
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
          size={size}
          stretch="auto"
          onClick={filter.saveView}
          label={filter.saveViewOptions?.label ?? "Save view"}
        />
      </ElementTransition>
      <ElementTransition show={filter.canUpdateView}>
        <Button
          variant="secondary"
          size={size}
          stretch="auto"
          onClick={() => void handleUpdate()}
          loading={isUpdating}
          disabled={isUpdating}
          label={isUpdating ? "Confirming" : (filter.updateViewOptions?.label ?? "Update view")}
        />
      </ElementTransition>
    </div>
  );
});
