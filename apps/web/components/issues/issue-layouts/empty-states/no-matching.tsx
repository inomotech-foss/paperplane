// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";

type Props = {
  onClear: () => void;
  disabled?: boolean;
};

/** Shown when filters or a PQL query leave a list empty. */
export function NoMatchingWorkItemsEmptyState(props: Props) {
  const { onClear, disabled } = props;
  const { t } = useTranslation();

  return (
    <EmptyStateDetailed
      assetKey="search"
      title={t("common_empty_state.search.title")}
      description={t("common_empty_state.search.description")}
      actions={[
        {
          label: t("project_issues.empty_state.issues_empty_filter.secondary_button.text"),
          onClick: onClear,
          disabled,
          variant: "secondary",
        },
      ]}
    />
  );
}
