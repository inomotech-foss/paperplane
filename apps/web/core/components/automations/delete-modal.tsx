/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TAutomation } from "@plane/types";
import { AlertModalCore } from "@plane/ui";
// hooks
import { useAutomation } from "@/hooks/store/use-automation";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  /** Omitted for workspace-scoped rules. */
  projectId?: string;
  automation: TAutomation;
};

export const AutomationDeleteModal = observer(function AutomationDeleteModal(props: Props) {
  const { isOpen, onClose, workspaceSlug, projectId, automation } = props;
  const { t } = useTranslation();
  const { deleteAutomation } = useAutomation();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAutomation(workspaceSlug, automation.id, projectId);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("automations.toasts.delete.success.title"),
        message: t("automations.toasts.delete.success.message", { name: automation.name }),
      });
      onClose();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("automations.toasts.delete.error.title"),
        // The API refuses to delete an enabled automation; surface that reason.
        message: (error as { error?: string })?.error ?? t("automations.toasts.delete.error.message"),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertModalCore
      handleClose={onClose}
      handleSubmit={handleDelete}
      isSubmitting={isDeleting}
      isOpen={isOpen}
      title={t("automations.delete_modal.heading")}
      content={automation.name}
    />
  );
});
