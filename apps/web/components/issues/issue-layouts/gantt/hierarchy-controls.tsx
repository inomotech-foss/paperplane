/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ChevronsDownUp, ChevronsUpDown, ListTree } from "lucide-react";
// plane imports
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@makeplane/propel/components/menu";
import { useTranslation } from "@plane/i18n";
// hooks
import { useIssuesTimeLineChart } from "@/hooks/use-timeline-chart";

type Props = {
  /** Levels among the loaded work items; "show N levels" is offered below this. */
  levelCount: number;
  /** The levels shown by default, null for all. */
  expandDepth: number | null;
  onShowLevels: (levels: number | null) => void;
};

/**
 * Fold and unfold the whole timeline at once and switch rolled-up dates on or off.
 */
export const GanttHierarchyControls = observer(function GanttHierarchyControls(props: Props) {
  const { levelCount, expandDepth, onShowLevels } = props;
  const { t } = useTranslation();
  const { isDateRollupEnabled, toggleDateRollup } = useIssuesTimeLineChart();

  const levels = Array.from({ length: Math.max(levelCount - 1, 0) }, (_, index) => index + 1);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="flex items-center gap-1 rounded-md bg-layer-transparent p-1 px-2 text-11 hover:bg-layer-transparent-hover"
        onClick={() => onShowLevels(null)}
        disabled={levelCount < 2}
      >
        <ChevronsUpDown className="size-3.5" />
        {t("timeline_hierarchy.expand_all")}
      </button>
      <button
        type="button"
        className="flex items-center gap-1 rounded-md bg-layer-transparent p-1 px-2 text-11 hover:bg-layer-transparent-hover"
        onClick={() => onShowLevels(1)}
        disabled={levelCount < 2}
      >
        <ChevronsDownUp className="size-3.5" />
        {t("timeline_hierarchy.collapse_all")}
      </button>
      <Menu>
        <MenuTrigger
          render={
            <button
              type="button"
              aria-label={t("timeline_hierarchy.menu")}
              className="flex items-center gap-1 rounded-md bg-layer-transparent p-1 px-2 text-11 hover:bg-layer-transparent-hover"
            />
          }
        >
          <ListTree className="size-3.5" />
          {t("timeline_hierarchy.menu")}
        </MenuTrigger>
        <MenuContent side="bottom" align="end">
          {levels.map((level) => (
            <MenuItem
              key={level}
              label={t("timeline_hierarchy.show_levels", { count: level })}
              selected={expandDepth === level}
              onClick={() => onShowLevels(level)}
            />
          ))}
          <MenuItem
            label={t("timeline_hierarchy.show_all_levels")}
            selected={expandDepth === null}
            onClick={() => onShowLevels(null)}
          />
          <MenuSeparator />
          <MenuCheckboxItem
            label={t("timeline_hierarchy.roll_up_dates")}
            checked={isDateRollupEnabled}
            onCheckedChange={() => toggleDateRollup()}
          />
        </MenuContent>
      </Menu>
    </div>
  );
});
