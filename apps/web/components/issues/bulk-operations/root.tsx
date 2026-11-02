/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { ArchiveOutline, CloseOutline, DeleteOutline, DueDateOutline, StartDateOutline } from "@makeplane/propel/icons";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { DateSelect } from "@plane/blocks/property-select";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TIssue } from "@plane/types";
import { cn, renderFormattedPayloadDate } from "@plane/utils";
// components
import { LabelSelect } from "@/components/dropdowns/label/label-select";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { StateSelect } from "@/components/dropdowns/state/state-select";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUserProfile } from "@/hooks/store/user";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// local imports
import { applyBulkChange, canArchiveAll } from "./bulk-update";
import type { TBulkChange } from "./bulk-update";

type Props = {
  className?: string;
  selectionHelpers: TSelectionHelper;
};

export const IssueBulkOperationsRoot = observer(function IssueBulkOperationsRoot(props: Props) {
  const { className, selectionHelpers } = props;
  const { isSelectionActive, selectedEntityIds } = useMultipleSelectStore();

  if (!isSelectionActive || selectionHelpers.isSelectionDisabled) return null;

  return (
    <IssueBulkOperationsBar
      className={className}
      issueIds={selectedEntityIds}
      onClear={selectionHelpers.handleClearSelection}
    />
  );
});

type TBarProps = {
  className?: string;
  issueIds: string[];
  onClear: () => void;
};

const IssueBulkOperationsBar = observer(function IssueBulkOperationsBar(props: TBarProps) {
  const { className, issueIds, onClear } = props;
  const { t } = useTranslation();
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const projectId = routerProjectId?.toString();
  // states
  const [isBusy, setIsBusy] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // store hooks
  const storeType = useIssueStoreType();
  const { issues, issueMap } = useIssues(storeType);
  const { updateIssue } = useIssuesActions(storeType);
  const { getStateById } = useProjectState();
  const { data: userProfile } = useUserProfile();
  // derived values
  const selectedIssues = issueIds.map((id) => issueMap[id]).filter((issue): issue is TIssue => !!issue);
  const isArchivable = canArchiveAll(selectedIssues.map((issue) => getStateById(issue.state_id)?.group));

  const handleChange = async (change: TBulkChange) => {
    if (!updateIssue || isBusy) return;
    setIsBusy(true);
    try {
      const result = await applyBulkChange(selectedIssues, change, (issue, data) =>
        updateIssue(issue.project_id, issue.id, data)
      );
      if (result.updated > 0) {
        setToast({
          type: "success",
          title: t("common.success"),
          message: t("bulk_operations.toast.updated", { count: result.updated }),
        });
      }
      if (result.invalidDates > 0) {
        const details =
          change.type === "target_date"
            ? "bulk_operations.error_details.invalid_issue_target_date"
            : "bulk_operations.error_details.invalid_issue_start_date";
        setToast({ type: "warning", title: t(`${details}.title`), message: t(`${details}.message`) });
      }
      if (result.failed > 0) {
        setToast({
          type: "error",
          title: t("bulk_operations.toast.update_failed_title"),
          message: t("bulk_operations.toast.update_failed", { count: result.failed }),
        });
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleArchive = async () => {
    if (!workspaceSlug || !projectId || !issues.archiveBulkIssues || isBusy) return;
    setIsBusy(true);
    try {
      await issues.archiveBulkIssues(workspaceSlug, projectId, issueIds);
      setToast({
        type: "success",
        title: t("common.success"),
        message: t("bulk_operations.toast.archived", { count: issueIds.length }),
      });
      onClear();
    } catch (error) {
      console.error(error);
      setToast({
        type: "error",
        title: t("bulk_operations.error_details.invalid_archive_state_group.title"),
        message: t("bulk_operations.error_details.invalid_archive_state_group.message"),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceSlug || !projectId) return;
    setIsDeleting(true);
    try {
      await issues.removeBulkIssues(workspaceSlug, projectId, issueIds);
      setToast({
        type: "success",
        title: t("common.success"),
        message: t("bulk_operations.toast.deleted", { count: issueIds.length }),
      });
      onClear();
    } catch (error) {
      console.error(error);
      setToast({ type: "error", title: t("common.error.label"), message: t("common.error.message") });
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  const toDate = (date: Date | null) => (date ? (renderFormattedPayloadDate(date) ?? null) : null);

  return (
    <div className={cn("sticky bottom-0 left-0 z-2 px-3.5 py-3", className)}>
      <div
        role="toolbar"
        aria-label={t("bulk_operations.toolbar_label")}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-subtle bg-surface-1 px-3 py-2 shadow-raised-200"
      >
        <span className="text-body-xs-medium whitespace-nowrap text-primary">
          {t("bulk_operations.selected", { count: issueIds.length })}
        </span>
        <IconButton
          variant="ghost"
          size="xs"
          aria-label={t("bulk_operations.clear_selection")}
          icon={<CloseOutline />}
          onClick={onClear}
        />
        <span aria-hidden className="bg-subtle h-5 w-px" />
        <StateSelect
          projectId={projectId}
          value={null}
          onChange={(stateId) => void handleChange({ type: "state", stateId })}
          placeholder={t("common.state")}
          disabled={isBusy}
          variant="pill-sm"
        />
        <PrioritySelect
          value={null}
          onChange={(priority) => void handleChange({ type: "priority", priority })}
          placeholder={t("common.priority")}
          disabled={isBusy}
          variant="pill-sm"
        />
        <MemberSelect
          projectId={projectId}
          value={null}
          onChange={(memberId) => void handleChange({ type: "assignee", memberId })}
          placeholder={t("common.assignees")}
          disabled={isBusy}
          variant="pill-sm"
        />
        <LabelSelect
          projectId={projectId}
          value={[]}
          onChange={(labelIds) => {
            const [labelId] = labelIds;
            if (labelId) void handleChange({ type: "label", labelId });
          }}
          placeholder={t("common.labels")}
          disabled={isBusy}
          variant="pill-sm"
        />
        <DateSelect
          value={null}
          onChange={(date) => void handleChange({ type: "start_date", date: toDate(date) })}
          placeholder={t("common.order_by.start_date")}
          icon={<StartDateOutline />}
          disabled={isBusy}
          weekStartsOn={userProfile?.start_of_the_week}
          variant="pill-sm"
        />
        <DateSelect
          value={null}
          onChange={(date) => void handleChange({ type: "target_date", date: toDate(date) })}
          placeholder={t("common.order_by.due_date")}
          icon={<DueDateOutline />}
          disabled={isBusy}
          weekStartsOn={userProfile?.start_of_the_week}
          variant="pill-sm"
        />
        <div className="ml-auto flex items-center gap-2">
          {issues.archiveBulkIssues && (
            <Tooltip
              label={t("bulk_operations.error_details.invalid_archive_state_group.message")}
              disabled={isArchivable}
            >
              <span>
                <Button
                  variant="secondary"
                  size="sm"
                  stretch="auto"
                  label={t("common.archive")}
                  icon={<ArchiveOutline />}
                  disabled={!isArchivable || isBusy}
                  onClick={() => void handleArchive()}
                />
              </span>
            </Tooltip>
          )}
          <Button
            variant="danger-outline"
            size="sm"
            stretch="auto"
            label={t("common.delete")}
            icon={<DeleteOutline />}
            disabled={isBusy}
            onClick={() => setIsDeleteOpen(true)}
          />
        </div>
      </div>
      <ConfirmDialog
        isOpen={isDeleteOpen}
        handleClose={() => setIsDeleteOpen(false)}
        handleSubmit={handleDelete}
        isSubmitting={isDeleting}
        title={t("bulk_operations.delete.title")}
        content={t("bulk_operations.delete.content", { count: issueIds.length })}
        variant="danger"
      />
    </div>
  );
});
