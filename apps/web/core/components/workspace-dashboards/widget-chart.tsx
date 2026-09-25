/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { useTheme } from "next-themes";
// plane imports
import { CHART_COLOR_PALETTES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { AreaChart } from "@plane/propel/charts/area-chart";
import { BarChart } from "@plane/propel/charts/bar-chart";
import { LineChart } from "@plane/propel/charts/line-chart";
import { PieChart } from "@plane/propel/charts/pie-chart";
import type { TAreaItem, TBarItem, TDashboardChartType, TDashboardWidgetData, TLineItem } from "@plane/types";
import { cn } from "@plane/utils";
// components
import { generateExtendedColors } from "@/components/chart/utils";
// local imports
import { formatMetricValue } from "./utils";

type Props = {
  chartType: TDashboardChartType;
  data: TDashboardWidgetData;
  /** The metric's name, shown as the axis label and the number's caption. */
  metricLabel: string;
  dimensionLabel: string;
  className?: string;
};

const VALUE_KEY = "count";

/** The first (bottom) or last (top) series with a value in a stacked bar, for its rounded corners. */
const outermostSeriesKey = (
  seriesKeys: string[],
  payload: Record<string, number | string>,
  edge: "top" | "bottom"
): string | undefined => {
  const step = edge === "top" ? -1 : 1;
  for (let index = edge === "top" ? seriesKeys.length - 1 : 0; index >= 0 && index < seriesKeys.length; index += step) {
    if (Number(payload[seriesKeys[index]]) > 0) return seriesKeys[index];
  }
  return undefined;
};

/** Draw evaluated widget data as the chart type the widget asks for. */
export function WidgetChart(props: Props) {
  const { chartType, data, metricLabel, dimensionLabel, className } = props;
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();

  const seriesKeys = useMemo(() => Object.keys(data.schema ?? {}), [data.schema]);
  const colors = useMemo(() => {
    const base = CHART_COLOR_PALETTES[0]?.[resolvedTheme === "dark" ? "dark" : "light"] ?? [];
    return generateExtendedColors(base, Math.max(seriesKeys.length, data.data.length, 1));
  }, [resolvedTheme, seriesKeys.length, data.data.length]);

  // Every chart plots `count` unless a series splits it into one key per series value.
  const valueKeys = seriesKeys.length > 0 ? seriesKeys : [VALUE_KEY];
  const labelFor = (key: string) => (key === VALUE_KEY ? metricLabel : (data.schema[key] ?? key));

  if (chartType === "number") {
    return (
      <div className={cn("flex h-full flex-col justify-center gap-1", className)}>
        <div className="text-28 font-semibold text-primary">{formatMetricValue(data.total)}</div>
        <div className="text-12 text-tertiary">
          {metricLabel} · {t("insight_dashboards.widget.row_count").replace("{count}", String(data.row_count))}
        </div>
      </div>
    );
  }

  if (data.data.length === 0) {
    return (
      <div className={cn("grid h-full place-items-center text-12 text-tertiary", className)}>
        {t("insight_dashboards.widget.no_data")}
      </div>
    );
  }

  if (chartType === "table") {
    return (
      <div className={cn("h-full overflow-auto", className)}>
        <table className="w-full text-12">
          <thead className="sticky top-0 bg-surface-1 text-left text-11 text-tertiary">
            <tr>
              <th className="py-1 pr-2 font-medium">{dimensionLabel}</th>
              {valueKeys.map((key) => (
                <th key={key} className="py-1 pr-2 text-right font-medium">
                  {labelFor(key)}
                </th>
              ))}
              {seriesKeys.length > 0 && <th className="py-1 text-right font-medium">{metricLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {data.data.map((row) => (
              <tr key={row.key} className="border-t border-subtle-1 text-primary">
                <td className="py-1 pr-2">{row.name}</td>
                {valueKeys.map((key) => (
                  <td key={key} className="py-1 pr-2 text-right tabular-nums">
                    {formatMetricValue(row[key] as number)}
                  </td>
                ))}
                {seriesKeys.length > 0 && (
                  <td className="py-1 text-right font-medium tabular-nums">{formatMetricValue(row.count)}</td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-strong-1 text-primary">
            <tr>
              <td className="py-1 pr-2 font-medium">{t("insight_dashboards.widget.total")}</td>
              <td
                className="py-1 pr-2 text-right font-medium tabular-nums"
                colSpan={valueKeys.length + (seriesKeys.length > 0 ? 1 : 0)}
              >
                {formatMetricValue(data.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  if (chartType === "pie" || chartType === "donut") {
    const slices = data.data.map((row, index) => ({
      key: row.key,
      name: row.name,
      value: Number(row.count) || 0,
      color: colors[index % colors.length],
    }));
    return (
      <PieChart
        className={cn("size-full", className)}
        dataKey="value"
        data={slices}
        cells={slices.map((slice) => ({ key: slice.key, fill: slice.color }))}
        showTooltip
        tooltipLabel={metricLabel}
        paddingAngle={2}
        cornerRadius={3}
        innerRadius={chartType === "donut" ? "55%" : 0}
        showLabel={false}
        legend={{ align: "right", verticalAlign: "middle", layout: "vertical" }}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
      />
    );
  }

  // The card's subtitle already names the metric and the dimension, so the axes carry no titles.
  const axisProps = {
    className: cn("size-full", className),
    data: data.data,
    xAxis: { key: "name" as const },
    yAxis: { key: "count" as const, allowDecimals: true },
    legend:
      seriesKeys.length > 0
        ? { align: "left" as const, verticalAlign: "bottom" as const, layout: "horizontal" as const }
        : undefined,
    margin: { top: 8, right: 8, bottom: 4, left: -8 },
  };
  // One colour per bar reads well for categories; a time series is one colour throughout.
  const isTimeSeries = "bucket" in data.dimension && !!data.dimension.bucket;

  if (chartType === "line") {
    const lines: TLineItem<string>[] = valueKeys.map((key, index) => ({
      key,
      label: labelFor(key),
      dashedLine: false,
      fill: colors[index % colors.length],
      stroke: colors[index % colors.length],
      showDot: data.data.length <= 40,
      smoothCurves: true,
    }));
    return <LineChart {...axisProps} lines={lines} />;
  }

  if (chartType === "area") {
    const areas: TAreaItem<string>[] = valueKeys.map((key, index) => ({
      key,
      label: labelFor(key),
      stackId: "area",
      fill: colors[index % colors.length],
      fillOpacity: 0.25,
      strokeColor: colors[index % colors.length],
      strokeOpacity: 1,
      showDot: false,
      smoothCurves: true,
    }));
    return <AreaChart {...axisProps} areas={areas} />;
  }

  const bars: TBarItem<string>[] = valueKeys.map((key, index) => ({
    key,
    label: labelFor(key),
    stackId: "bar",
    fill:
      seriesKeys.length > 0 || isTimeSeries
        ? colors[index % colors.length]
        : (payload: { key?: string }) =>
            colors[
              Math.max(
                0,
                data.data.findIndex((row) => row.key === payload?.key)
              ) % colors.length
            ],
    textClassName: "",
    showPercentage: false,
    showTopBorderRadius: (barKey: string, payload: Record<string, number | string>) =>
      seriesKeys.length === 0 || barKey === outermostSeriesKey(seriesKeys, payload, "top"),
    showBottomBorderRadius: (barKey: string, payload: Record<string, number | string>) =>
      seriesKeys.length === 0 || barKey === outermostSeriesKey(seriesKeys, payload, "bottom"),
  }));
  return (
    <BarChart {...axisProps} bars={bars} barSize={Math.max(12, Math.min(40, 400 / Math.max(1, data.data.length)))} />
  );
}
