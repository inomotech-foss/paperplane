/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { CircularProgress } from "@makeplane/propel/components/circular-progress";
import { useTranslation } from "@plane/i18n";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";

type Props = {
  parentIssueId: string;
};

export const SubIssuesCollapsibleTitle = observer(function SubIssuesCollapsibleTitle(props: Props) {
  const { parentIssueId } = props;
  // translation
  const { t } = useTranslation();
  // store hooks
  const {
    subIssues: { subIssuesByIssueId, stateDistributionByIssueId },
  } = useIssueDetail();
  // derived values
  const subIssuesDistribution = stateDistributionByIssueId(parentIssueId);
  const subIssues = subIssuesByIssueId(parentIssueId);
  // if there are no sub-issues, return null
  if (!subIssues) return null;

  // calculate percentage of completed sub-issues
  const completedCount = subIssuesDistribution?.completed?.length ?? 0;
  const totalCount = subIssues.length;
  const percentage = completedCount && totalCount ? (completedCount / totalCount) * 100 : 0;

  return (
    <span className="inline-flex items-center gap-2">
      {t("common.sub_work_items")}
      <span className="flex items-center gap-1.5 text-13 text-tertiary">
        <CircularProgress
          value={percentage}
          size="md"
          variant={percentage === 100 ? "success" : "brand"}
          aria-label="Sub-work-item progress"
        />
        <span>
          {completedCount}/{totalCount} {t("common.done")}
        </span>
      </span>
    </span>
  );
});
