/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { Switch } from "@makeplane/propel/components/switch";
import { setToast } from "@plane/blocks/toast";
import type { TWorkspaceDashboard } from "@plane/types";
import { Dialog, DialogBody, DialogContent } from "@makeplane/propel/components/dialog";
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { TextArea, TextAreaGroup } from "@makeplane/propel/components/text-area";
// hooks
import { useWorkspaceDashboards } from "@/hooks/store/use-workspace-dashboards";

type Props = {
  isOpen: boolean;
  workspaceSlug: string;
  dashboard?: TWorkspaceDashboard;
  onClose: () => void;
  onCreated?: (dashboard: TWorkspaceDashboard) => void;
};

/**
 * The form mounts when the modal opens and unmounts when it closes, so its
 * fields start from the dashboard being edited every time without an effect.
 */
export const CreateUpdateDashboardModal = observer(function CreateUpdateDashboardModal(props: Props) {
  const { isOpen, workspaceSlug, dashboard, onClose, onCreated } = props;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogBody tabIndex={0}>
          {isOpen && (
            <DashboardForm
              key={dashboard?.id ?? "new"}
              workspaceSlug={workspaceSlug}
              dashboard={dashboard}
              onClose={onClose}
              onCreated={onCreated}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
});

type TFormProps = Omit<Props, "isOpen">;

const DashboardForm = observer(function DashboardForm(props: TFormProps) {
  const { workspaceSlug, dashboard, onClose, onCreated } = props;
  const { t } = useTranslation();
  const { createDashboard, updateDashboard } = useWorkspaceDashboards();
  // states
  const [name, setName] = useState(dashboard?.name ?? "");
  const [description, setDescription] = useState(dashboard?.description ?? "");
  const [isPublic, setIsPublic] = useState(dashboard ? dashboard.access === 1 : true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        type: "error",
        title: t("common.error.label"),
        message: (apiError as { error?: string })?.error ?? t("insight_dashboards.form.save_error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <h3 className="text-16 font-medium text-primary">
        {dashboard ? t("insight_dashboards.form.edit_title") : t("insight_dashboards.form.create_title")}
      </h3>
      <div className="flex flex-col gap-1">
        <label className="text-12 text-secondary" htmlFor="dashboard-name">
          {t("insight_dashboards.form.name")}
        </label>
        <Field invalid={!!error}>
          <InputGroup size="md">
            <Input
              id="dashboard-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("insight_dashboards.form.name_placeholder")}
              size="md"
            />
          </InputGroup>
        </Field>
        {error && <p className="text-11 text-danger-primary">{error}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-12 text-secondary" htmlFor="dashboard-description">
          {t("insight_dashboards.form.description")}
        </label>
        <TextAreaGroup>
          <TextArea
            id="dashboard-description"
            size="md"
            surface="field"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </TextAreaGroup>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-12 text-secondary">{t("insight_dashboards.form.public")}</span>
          <span className="text-11 text-tertiary">{t("insight_dashboards.form.public_help")}</span>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={() => setIsPublic((value) => !value)}
          size="sm"
          aria-label={t("insight_dashboards.form.public")}
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-subtle-1 pt-3">
        <Button variant="tertiary" size="sm" onClick={onClose} stretch="auto" label={t("cancel")} />
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleSubmit()}
          loading={isSubmitting}
          stretch="auto"
          label={dashboard ? t("insight_dashboards.form.save") : t("insight_dashboards.form.create")}
        />
      </div>
    </div>
  );
});
