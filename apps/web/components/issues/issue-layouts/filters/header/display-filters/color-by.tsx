// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useState } from "react";
import { observer } from "mobx-react";
import { DEFAULT_TIMELINE_COLOR_BY, TIMELINE_COLOR_BY_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IIssueDisplayFilterOptions, ILayoutDisplayFiltersOptions } from "@plane/types";
// components
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters";

type Props = {
  displayFilters: IIssueDisplayFilterOptions | undefined;
  layoutDisplayFiltersOptions: ILayoutDisplayFiltersOptions | undefined;
  handleDisplayFiltersUpdate: (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => void;
};

export const FilterColorBy = observer(function FilterColorBy(props: Props) {
  const { displayFilters, layoutDisplayFiltersOptions, handleDisplayFiltersUpdate } = props;
  const { t } = useTranslation();

  const [previewEnabled, setPreviewEnabled] = useState(true);

  const enabledKeys = new Set(layoutDisplayFiltersOptions?.display_filters.color_by ?? []);
  if (enabledKeys.size === 0) return null;

  const activeColorBy = displayFilters?.color_by ?? DEFAULT_TIMELINE_COLOR_BY;

  return (
    <div className="py-2">
      <FilterHeader
        title={t("issue.display.color_by.label")}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {TIMELINE_COLOR_BY_OPTIONS.filter((option) => enabledKeys.has(option.key)).map((option) => (
            <FilterOption
              key={option.key}
              isChecked={activeColorBy === option.key}
              onClick={() => handleDisplayFiltersUpdate({ color_by: option.key })}
              title={t(option.titleTranslationKey)}
              multiple={false}
            />
          ))}
        </div>
      )}
    </div>
  );
});
