/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { renderFormattedDate } from "@plane/utils";
import { useMember } from "@/hooks/store/use-member";
import type { TTrashedIssue } from "@/services/issue/issue-trash.service";

type Props = {
  issue: TTrashedIssue;
  canPurge: boolean;
  isRestoring: boolean;
  onRestore: (issue: TTrashedIssue) => void;
  onPurge: (issue: TTrashedIssue) => void;
};

export const DeletedWorkItemListItem = observer(function DeletedWorkItemListItem(props: Props) {
  const { issue, canPurge, isRestoring, onRestore, onPurge } = props;
  const { getUserDetails } = useMember();
  const { t } = useTranslation();

  const deletedBy = issue.deleted_by ? getUserDetails(issue.deleted_by)?.display_name : undefined;
  const deletedOn = renderFormattedDate(issue.deleted_at ?? "") ?? "";

  return (
    <div className="flex items-center gap-4 border-b border-subtle px-6 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-13 font-medium text-primary">
          <span className="mr-2 text-tertiary">
            {issue.project_identifier}-{issue.sequence_id}
          </span>
          {issue.name}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-11 text-placeholder">
          <span>
            {deletedBy
              ? t("issue.trash.deleted_by", { name: deletedBy, date: deletedOn })
              : t("issue.trash.deleted_on", { date: deletedOn })}
          </span>
          <span>{t("issue.trash.purge_on", { date: renderFormattedDate(issue.purge_at) ?? "" })}</span>
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        stretch="auto"
        label={t("issue.trash.restore")}
        loading={isRestoring}
        onClick={() => onRestore(issue)}
      />
      {canPurge && (
        <Button
          variant="danger-outline"
          size="sm"
          stretch="auto"
          label={t("issue.trash.delete_permanently")}
          onClick={() => onPurge(issue)}
        />
      )}
    </div>
  );
});
