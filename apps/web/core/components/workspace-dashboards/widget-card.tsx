/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type {
  TDashboardOptions,
  TDashboardWidgetData,
  TDashboardWidgetError,
  TWorkspaceDashboardWidget,
} from "@plane/types";
import { CustomMenu, Loader } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import { useWorkspaceDashboards } from "@/hooks/store/use-workspace-dashboards";
// local imports
import { buildDimensionChoices, dimensionLabel, isFullWidth, metricLabel } from "./utils";
import { WidgetChart } from "./widget-chart";

type Props = {
  workspaceSlug: string;
  widget: TWorkspaceDashboardWidget;
  options: TDashboardOptions | undefined;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export const widgetDataKey = (workspaceSlug: string, widget: TWorkspaceDashboardWidget) =>
  `WORKSPACE_DASHBOARD_WIDGET_${workspaceSlug}_${widget.dashboard}_${widget.id}_${widget.updated_at ?? ""}`;

/** One widget on the board: title, chart and the owner's actions. */
export const WidgetCard = observer(function WidgetCard(props: Props) {
  const { workspaceSlug, widget, options, canEdit, onEdit, onDelete } = props;
  const { t } = useTranslation();
  const { fetchWidgetData } = useWorkspaceDashboards();

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    widgetDataKey(workspaceSlug, widget),
    () => fetchWidgetData(workspaceSlug, widget.dashboard, widget.id),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const choices = buildDimensionChoices(options, t);
  const metric = metricLabel(widget, options, t);
  const dimension = dimensionLabel(widget.dimension, choices, t);
  const isNumber = widget.chart_type === "number";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-subtle-1 bg-surface-1 p-4",
        isFullWidth(widget) ? "md:col-span-2 xl:col-span-3" : "",
        isNumber ? "min-h-[160px]" : "min-h-[340px]"
      )}
    >
      <WidgetCardHeader
        widget={widget}
        metric={metric}
        dimension={dimension}
        canEdit={canEdit}
        isRefreshing={isValidating}
        onRefresh={() => void mutate()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      <div className="min-h-0 flex-1">
        <WidgetCardBody
          widget={widget}
          data={data}
          error={error as TDashboardWidgetError | undefined}
          isLoading={isLoading}
          metric={metric}
          dimension={dimension}
        />
      </div>
      {widget.query && (
        <code
          className="font-mono truncate rounded-sm bg-layer-2 px-1.5 py-0.5 text-10 text-tertiary"
          title={widget.query}
        >
          {widget.query}
        </code>
      )}
    </div>
  );
});

type THeaderProps = {
  widget: TWorkspaceDashboardWidget;
  metric: string;
  dimension: string;
  canEdit: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function WidgetCardHeader(props: THeaderProps) {
  const { widget, metric, dimension, canEdit, isRefreshing, onRefresh, onEdit, onDelete } = props;
  const { t } = useTranslation();
  const subtitle = widget.description || widgetSubtitle(metric, dimension, t);

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-col">
        <h3 className="truncate text-14 font-medium text-primary" title={widget.title}>
          {widget.title}
        </h3>
        <p className="truncate text-11 text-tertiary" title={subtitle}>
          {subtitle}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="grid size-6 place-items-center rounded-sm text-tertiary hover:bg-layer-2 hover:text-primary"
          onClick={onRefresh}
          aria-label={t("insight_dashboards.widget.refresh")}
          title={t("insight_dashboards.widget.refresh")}
        >
          <RefreshCw className={cn("size-3.5", { "animate-spin": isRefreshing })} />
        </button>
        {canEdit && <WidgetCardMenu onEdit={onEdit} onDelete={onDelete} />}
      </div>
    </div>
  );
}

function WidgetCardMenu(props: { onEdit: () => void; onDelete: () => void }) {
  const { onEdit, onDelete } = props;
  const { t } = useTranslation();
  return (
    <CustomMenu ellipsis placement="bottom-end" closeOnSelect>
      <CustomMenu.MenuItem onClick={onEdit}>
        <span className="flex items-center gap-2">
          <Pencil className="size-3.5" />
          {t("insight_dashboards.widget.edit")}
        </span>
      </CustomMenu.MenuItem>
      <CustomMenu.MenuItem onClick={onDelete}>
        <span className="flex items-center gap-2 text-danger-primary">
          <Trash2 className="size-3.5" />
          {t("insight_dashboards.widget.delete")}
        </span>
      </CustomMenu.MenuItem>
    </CustomMenu>
  );
}

type TBodyProps = {
  widget: TWorkspaceDashboardWidget;
  data: TDashboardWidgetData | undefined;
  error: TDashboardWidgetError | undefined;
  isLoading: boolean;
  metric: string;
  dimension: string;
};

function WidgetCardBody(props: TBodyProps) {
  const { widget, data, error, isLoading, metric, dimension } = props;
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <Loader className="size-full">
        <Loader.Item height="100%" width="100%" />
      </Loader>
    );
  }
  if (error) {
    return (
      <div className="grid h-full place-items-center px-2 text-center text-12 text-danger-primary">
        {error.error ?? t("insight_dashboards.widget.load_error")}
      </div>
    );
  }
  if (!data) return null;
  return (
    <WidgetChart
      chartType={widget.chart_type}
      data={data}
      metricLabel={metric}
      dimensionLabel={dimension}
      className={widget.chart_type === "number" ? "" : "h-[280px]"}
    />
  );
}

/** "Sum · Amount by Month" when the widget has no subtitle of its own. */
export const widgetSubtitle = (metric: string, dimension: string, t: (key: string) => string): string =>
  dimension ? `${metric} · ${t("insight_dashboards.widget.by").replace("{dimension}", dimension)}` : metric;
