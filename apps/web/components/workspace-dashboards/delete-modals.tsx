/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { TWorkspaceDashboard, TWorkspaceDashboardWidget } from "@plane/types";
import { ConfirmDialog } from "@plane/blocks/dialog";
// hooks
import { useWorkspaceDashboards } from "@/hooks/store/use-workspace-dashboards";

type TDeleteDashboardProps = {
  isOpen: boolean;
  workspaceSlug: string;
  dashboard: TWorkspaceDashboard | null;
  onClose: () => void;
  onDeleted?: () => void;
};

export const DeleteDashboardModal = observer(function DeleteDashboardModal(props: TDeleteDashboardProps) {
  const { isOpen, workspaceSlug, dashboard, onClose, onDeleted } = props;
  const { t } = useTranslation();
  const { deleteDashboard } = useWorkspaceDashboards();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!dashboard) return;
    setIsSubmitting(true);
    try {
      await deleteDashboard(workspaceSlug, dashboard.id);
      onClose();
      onDeleted?.();
    } catch (error) {
      setToast({
        type: "error",
        title: t("common.error.label"),
        message: (error as { error?: string })?.error ?? t("insight_dashboards.delete.error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      handleClose={onClose}
      handleSubmit={() => void handleDelete()}
      isSubmitting={isSubmitting}
      title={t("insight_dashboards.delete.title")}
      content={t("insight_dashboards.delete.content").replace("{name}", dashboard?.name ?? "")}
    />
  );
});

type TDeleteWidgetProps = {
  isOpen: boolean;
  workspaceSlug: string;
  widget: TWorkspaceDashboardWidget | null;
  onClose: () => void;
};

export const DeleteWidgetModal = observer(function DeleteWidgetModal(props: TDeleteWidgetProps) {
  const { isOpen, workspaceSlug, widget, onClose } = props;
  const { t } = useTranslation();
  const { deleteWidget } = useWorkspaceDashboards();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!widget) return;
    setIsSubmitting(true);
    try {
      await deleteWidget(workspaceSlug, widget.dashboard, widget.id);
      onClose();
    } catch (error) {
      setToast({
        type: "error",
        title: t("common.error.label"),
        message: (error as { error?: string })?.error ?? t("insight_dashboards.widget.delete_error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      handleClose={onClose}
      handleSubmit={() => void handleDelete()}
      isSubmitting={isSubmitting}
      title={t("insight_dashboards.widget.delete_title")}
      content={t("insight_dashboards.widget.delete_content").replace("{title}", widget?.title ?? "")}
    />
  );
});
