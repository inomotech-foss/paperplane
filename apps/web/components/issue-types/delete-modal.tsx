/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
// plane imports
import {
  AlertDialog,
  AlertDialogActions,
  AlertDialogBody,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogIntro,
  AlertDialogTitle,
} from "@makeplane/propel/components/alert-dialog";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { ApiError } from "@plane/services";
import type { TIssueType } from "@plane/types";
// components
import { IssueTypeDropdown } from "@/components/dropdowns/issue-type";
// hooks
import { useIssueTypes } from "@/hooks/store/use-issue-types";
// services
import { countTypeReferences, IssueTypeRemovalService } from "@/services/issue/issue-type-removal.service";
import type { TIssueTypeUsage } from "@/services/issue/issue-type-removal.service";

const removalService = new IssueTypeRemovalService();

type TDeleteIssueTypeModalProps = {
  isOpen: boolean;
  issueType: TIssueType | null;
  onClose: () => void;
};

/** Why the type cannot simply go, or the plain warning when nothing uses it. */
const useUsageMessage = (usage: TIssueTypeUsage | undefined) => {
  const { t } = useTranslation();
  if (!usage || countTypeReferences(usage) === 0)
    return t("work_item_types.settings.item_delete_confirmation.description");
  if (usage.work_items === 0) return t("work_item_types.settings.item_delete_confirmation.only_hidden");
  const inUse = t("work_item_types.settings.item_delete_confirmation.in_use", { count: usage.work_items });
  return usage.deleted_work_items > 0
    ? `${inUse} ${t("work_item_types.settings.item_delete_confirmation.deleted_too")}`
    : inUse;
};

export const DeleteIssueTypeModal = observer(function DeleteIssueTypeModal(props: TDeleteIssueTypeModalProps) {
  const { isOpen, issueType, onClose } = props;
  // router
  const { workspaceSlug, projectId } = useParams();
  // states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replacementTypeId, setReplacementTypeId] = useState<string>();
  // i18n
  const { t } = useTranslation();
  // store hooks
  const { deleteIssueType } = useIssueTypes();
  // the rows that still use the type, fetched each time the dialog opens
  const { data: usage } = useSWR(
    isOpen && issueType && workspaceSlug && projectId ? `ISSUE_TYPE_USAGE_${issueType.id}` : null,
    () => removalService.getUsage(workspaceSlug.toString(), projectId.toString(), issueType?.id ?? ""),
    { revalidateOnFocus: false }
  );
  const message = useUsageMessage(usage);
  const needsReplacement = !!usage && countTypeReferences(usage) > 0;

  const handleClose = () => {
    if (isSubmitting) return;
    setReplacementTypeId(undefined);
    onClose();
  };

  const handleDelete = async () => {
    if (!issueType || !workspaceSlug || !projectId) return;
    setIsSubmitting(true);
    try {
      await deleteIssueType(
        workspaceSlug.toString(),
        projectId.toString(),
        issueType.id,
        needsReplacement ? replacementTypeId : undefined
      );
      setReplacementTypeId(undefined);
      onClose();
    } catch (error) {
      setToast({
        type: "error",
        title: t("work_item_types.settings.item_delete_confirmation.toast.error.title"),
        message:
          (error instanceof ApiError && error.error) ||
          t("work_item_types.settings.item_delete_confirmation.toast.error.message"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent data-prevent-outside-click>
        <AlertDialogBody>
          <AlertDialogHeader>
            <AlertDialogIcon variant="danger" />
            <AlertDialogIntro>
              <AlertDialogTitle>{t("work_item_types.settings.item_delete_confirmation.title")}</AlertDialogTitle>
              <AlertDialogDescription>{message}</AlertDialogDescription>
            </AlertDialogIntro>
          </AlertDialogHeader>
          {needsReplacement && issueType && (
            <div className="mt-4 flex flex-col gap-1.5">
              <span className="text-13 font-medium text-secondary">
                {t("work_item_types.settings.item_delete_confirmation.replacement_label")}
              </span>
              <IssueTypeDropdown
                projectId={projectId?.toString()}
                value={replacementTypeId}
                onChange={setReplacementTypeId}
                filterTypes={(type) => type.id !== issueType.id && type.is_epic === issueType.is_epic}
                variant="select-md"
                className="w-full"
              />
            </div>
          )}
        </AlertDialogBody>
        <AlertDialogActions>
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label={t("cancel")}
            disabled={isSubmitting}
            render={<AlertDialogClose />}
          />
          <Button
            variant="danger"
            size="sm"
            stretch="auto"
            onClick={() => void handleDelete()}
            disabled={!usage || (needsReplacement && !replacementTypeId)}
            loading={isSubmitting}
            label={isSubmitting ? t("deleting") : t("delete")}
          />
        </AlertDialogActions>
      </AlertDialogContent>
    </AlertDialog>
  );
});
