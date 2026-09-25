/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TDashboardOptions, TDashboardWidgetData, TWorkspaceDashboardWidget } from "@plane/types";
import { EModalWidth, ModalCore } from "@plane/ui";
// hooks
import { useWorkspaceDashboards } from "@/hooks/store/use-workspace-dashboards";
// local imports
import type { TFieldErrors, TWidgetForm } from "./use-widget-form";
import { parseWidgetErrors, useWidgetForm } from "./use-widget-form";
import { dimensionLabel, metricLabel } from "./utils";
import { WidgetChart } from "./widget-chart";
import { WidgetFormFields } from "./widget-form-fields";

type Props = {
  isOpen: boolean;
  workspaceSlug: string;
  dashboardId: string;
  widget?: TWorkspaceDashboardWidget;
  options: TDashboardOptions | undefined;
  onClose: () => void;
};

/**
 * Create or edit a widget: what to count, over which work items, split how,
 * drawn as what. The form mounts per open widget, so it starts from that
 * widget's definition without copying props into state.
 */
export const WidgetEditorModal = observer(function WidgetEditorModal(props: Props) {
  const { isOpen, workspaceSlug, dashboardId, widget, options, onClose } = props;
  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} width={EModalWidth.VXL}>
      {isOpen && (
        <WidgetEditorForm
          key={widget?.id ?? "new"}
          workspaceSlug={workspaceSlug}
          dashboardId={dashboardId}
          widget={widget}
          options={options}
          onClose={onClose}
        />
      )}
    </ModalCore>
  );
});

type TFormProps = Omit<Props, "isOpen">;

const WidgetEditorForm = observer(function WidgetEditorForm(props: TFormProps) {
  const { workspaceSlug, dashboardId, widget, options, onClose } = props;
  const { t } = useTranslation();
  const { createWidget, updateWidget, previewWidget } = useWorkspaceDashboards();
  const form = useWidgetForm(widget, options, t);
  // preview & submit state
  const [preview, setPreview] = useState<TDashboardWidgetData | null>(null);
  const [errors, setErrors] = useState<TFieldErrors>({});
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runPreview = async () => {
    setIsPreviewing(true);
    setErrors({});
    try {
      setPreview(await previewWidget(workspaceSlug, form.definition));
    } catch (error) {
      setPreview(null);
      setErrors(parseWidgetErrors(error));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setErrors({ title: t("insight_dashboards.editor.title_required") });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: Partial<TWorkspaceDashboardWidget> = {
        title: form.title.trim(),
        description: form.description.trim(),
        ...form.definition,
        config: { width: form.fullWidth ? "full" : "half" },
      };
      if (widget) await updateWidget(workspaceSlug, dashboardId, widget.id, payload);
      else await createWidget(workspaceSlug, dashboardId, payload);
      onClose();
    } catch (error) {
      const parsed = parseWidgetErrors(error);
      setErrors(parsed);
      if (Object.keys(parsed).length === 0) {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: t("common.error.label"),
          message: t("insight_dashboards.editor.save_error"),
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-4">
        <h3 className="text-16 font-medium text-primary">
          {widget ? t("insight_dashboards.editor.edit_title") : t("insight_dashboards.editor.create_title")}
        </h3>
        <WidgetFormFields form={form} errors={errors} />
      </div>
      <WidgetPreviewPanel
        form={form}
        options={options}
        preview={preview}
        isPreviewing={isPreviewing}
        isSubmitting={isSubmitting}
        isEditing={!!widget}
        onPreview={() => void runPreview()}
        onSubmit={() => void handleSubmit()}
        onClose={onClose}
      />
    </div>
  );
});

type TPreviewProps = {
  form: TWidgetForm;
  options: TDashboardOptions | undefined;
  preview: TDashboardWidgetData | null;
  isPreviewing: boolean;
  isSubmitting: boolean;
  isEditing: boolean;
  onPreview: () => void;
  onSubmit: () => void;
  onClose: () => void;
};

function WidgetPreviewPanel(props: TPreviewProps) {
  const { form, options, preview, isPreviewing, isSubmitting, isEditing, onPreview, onSubmit, onClose } = props;
  const { t } = useTranslation();
  const metric = metricLabel(form.definition, options, t);
  const dimension = dimensionLabel(form.definition.dimension, form.choices, t);
  const caption = dimension
    ? `${metric} · ${t("insight_dashboards.widget.by").replace("{dimension}", dimension)}`
    : metric;

  return (
    <div className="flex min-h-[360px] flex-col gap-3 rounded-lg border border-subtle-1 bg-layer-1 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-13 font-medium text-primary">{t("insight_dashboards.editor.preview")}</span>
          <span className="text-11 text-tertiary">{caption}</span>
        </div>
        <Button variant="secondary" size="sm" onClick={onPreview} loading={isPreviewing}>
          {t("insight_dashboards.editor.run_preview")}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {preview ? (
          <WidgetChart
            chartType={form.chartType}
            data={preview}
            metricLabel={metric}
            dimensionLabel={dimension}
            className={form.chartType === "number" ? "" : "h-[300px]"}
          />
        ) : (
          <div className="grid h-full min-h-[240px] place-items-center text-center text-12 text-tertiary">
            {t("insight_dashboards.editor.preview_hint")}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-subtle-1 pt-3">
        <Button variant="tertiary" size="sm" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button variant="primary" size="sm" onClick={onSubmit} loading={isSubmitting}>
          {isEditing ? t("insight_dashboards.editor.save") : t("insight_dashboards.editor.add")}
        </Button>
      </div>
    </div>
  );
}
