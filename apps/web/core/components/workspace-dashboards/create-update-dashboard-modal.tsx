/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TWorkspaceDashboard } from "@plane/types";
import { EModalWidth, Input, ModalCore, TextArea, ToggleSwitch } from "@plane/ui";
// hooks
import { useWorkspaceDashboards } from "@/hooks/store/use-workspace-dashboards";

type Props = {
  isOpen: boolean;
  workspaceSlug: string;
  dashboard?: TWorkspaceDashboard;
  onClose: () => void;
  onCreated?: (dashboard: TWorkspaceDashboard) => void;
};

export const CreateUpdateDashboardModal = observer(function CreateUpdateDashboardModal(props: Props) {
  const { isOpen, workspaceSlug, dashboard, onClose, onCreated } = props;
  const { t } = useTranslation();
  const { createDashboard, updateDashboard } = useWorkspaceDashboards();
  // states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(dashboard?.name ?? "");
    setDescription(dashboard?.description ?? "");
    setIsPublic(dashboard ? dashboard.access === 1 : true);
    setError(null);
  }, [isOpen, dashboard]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t("insight_dashboards.form.name_required"));
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: Partial<TWorkspaceDashboard> = {
        name: name.trim(),
        description: description.trim(),
        access: isPublic ? 1 : 0,
      };
      if (dashboard) await updateDashboard(workspaceSlug, dashboard.id, payload);
      else onCreated?.(await createDashboard(workspaceSlug, payload));
      onClose();
    } catch (apiError) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error.label"),
        message: (apiError as { error?: string })?.error ?? t("insight_dashboards.form.save_error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} width={EModalWidth.XL}>
      <div className="flex flex-col gap-4 p-5">
        <h3 className="text-16 font-medium text-primary">
          {dashboard ? t("insight_dashboards.form.edit_title") : t("insight_dashboards.form.create_title")}
        </h3>
        <div className="flex flex-col gap-1">
          <label className="text-12 text-secondary" htmlFor="dashboard-name">
            {t("insight_dashboards.form.name")}
          </label>
          <Input
            id="dashboard-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("insight_dashboards.form.name_placeholder")}
            hasError={!!error}
            className="w-full"
          />
          {error && <p className="text-11 text-danger-primary">{error}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-12 text-secondary" htmlFor="dashboard-description">
            {t("insight_dashboards.form.description")}
          </label>
          <TextArea
            id="dashboard-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-[72px] w-full"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-12 text-secondary">{t("insight_dashboards.form.public")}</span>
            <span className="text-11 text-tertiary">{t("insight_dashboards.form.public_help")}</span>
          </div>
          <ToggleSwitch value={isPublic} onChange={() => setIsPublic((value) => !value)} size="sm" />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-subtle-1 pt-3">
          <Button variant="tertiary" size="sm" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button variant="primary" size="sm" onClick={() => void handleSubmit()} loading={isSubmitting}>
            {dashboard ? t("insight_dashboards.form.save") : t("insight_dashboards.form.create")}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
