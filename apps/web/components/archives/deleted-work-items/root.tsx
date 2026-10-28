/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWRInfinite from "swr/infinite";
import { Button } from "@makeplane/propel/components/button";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { Loader } from "@plane/blocks/skeleton";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { useUserPermissions } from "@/hooks/store/user";
import type { TTrashedIssue, TTrashedIssuePage } from "@/services/issue/issue-trash.service";
import { IssueTrashService } from "@/services/issue/issue-trash.service";
import { DeletedWorkItemListItem } from "./list-item";

const issueTrashService = new IssueTrashService();

const identifier = (issue: TTrashedIssue) => `${issue.project_identifier}-${issue.sequence_id}`;

type Props = {
  workspaceSlug: string;
  projectId: string;
};

export const DeletedWorkItemsRoot = observer(function DeletedWorkItemsRoot(props: Props) {
  const { workspaceSlug, projectId } = props;
  const [restoringId, setRestoringId] = useState<string | undefined>(undefined);
  const [purging, setPurging] = useState<TTrashedIssue | undefined>(undefined);
  const [isPurging, setIsPurging] = useState(false);
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite(
    (_: number, previous: TTrashedIssuePage | null) =>
      previous && !previous.next_page_results
        ? null
        : ["DELETED_WORK_ITEMS", workspaceSlug, projectId, previous?.next_cursor],
    ([, slug, project, cursor]: [string, string, string, string | undefined]) =>
      issueTrashService.list(slug, project, cursor)
  );
  const issues = data?.flatMap((page) => page.results) ?? [];
  const hasMore = Boolean(data?.[data.length - 1]?.next_page_results);
  const canPurge = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);

  const handleRestore = async (issue: TTrashedIssue) => {
    setRestoringId(issue.id);
    try {
      await issueTrashService.restore(workspaceSlug, projectId, issue.id);
      await mutate();
      setToast({
        type: "success",
        title: t("success"),
        message: t("issue.trash.restored", { identifier: identifier(issue) }),
      });
    } catch {
      setToast({ type: "error", title: t("error"), message: t("issue.trash.restore_failed") });
    } finally {
      setRestoringId(undefined);
    }
  };

  const handlePurge = async () => {
    if (!purging) return;
    setIsPurging(true);
    try {
      await issueTrashService.purge(workspaceSlug, projectId, purging.id);
      await mutate();
      setToast({
        type: "success",
        title: t("success"),
        message: t("issue.trash.purged", { identifier: identifier(purging) }),
      });
      setPurging(undefined);
    } catch {
      setToast({ type: "error", title: t("error"), message: t("issue.trash.purge_failed") });
    } finally {
      setIsPurging(false);
    }
  };

  if (error) {
    return (
      <div className="h-full place-items-center">
        <EmptyStateDetailed
          assetKey="archived-work-item"
          title={t("something_went_wrong")}
          description={t("something_went_wrong_please_try_again")}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <Loader className="space-y-3 p-6">
        <Loader.Item height="40px" />
        <Loader.Item height="40px" />
        <Loader.Item height="40px" />
      </Loader>
    );
  }

  return (
    <div className="relative h-full w-full overflow-auto">
      {issues.length === 0 ? (
        <div className="h-full place-items-center">
          <EmptyStateDetailed
            assetKey="archived-work-item"
            title={t("issue.trash.empty_title")}
            description={t("issue.trash.empty_description")}
          />
        </div>
      ) : (
        <>
          {issues.map((issue) => (
            <DeletedWorkItemListItem
              key={issue.id}
              issue={issue}
              canPurge={canPurge}
              isRestoring={restoringId === issue.id}
              onRestore={handleRestore}
              onPurge={setPurging}
            />
          ))}
          {hasMore && (
            <div className="flex justify-center py-4">
              <Button
                variant="ghost"
                size="sm"
                stretch="auto"
                label={t("issue.trash.load_more")}
                loading={isValidating}
                onClick={() => setSize(size + 1)}
              />
            </div>
          )}
        </>
      )}
      <ConfirmDialog
        isOpen={Boolean(purging)}
        handleClose={() => setPurging(undefined)}
        handleSubmit={handlePurge}
        isSubmitting={isPurging}
        title={t("issue.trash.purge_title", { identifier: purging ? identifier(purging) : "" })}
        content={t("issue.trash.purge_description")}
      />
    </div>
  );
});
