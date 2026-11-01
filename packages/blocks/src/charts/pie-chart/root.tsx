/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useMemo, useState } from "react";
import { Cell, PieChart as CorePieChart, Label, Legend, Pie, ResponsiveContainer, Tooltip } from "recharts";
import type { PieLabelRenderProps } from "recharts";
// plane imports
import { readField } from "@plane/types";
import type { TPieChartProps } from "@plane/types";
// local components
import { getLegendProps } from "../components/legend";
import { isChartPayload, toChartKey, toChartText, toDominantBaseline, toTextAnchor } from "../payload";
import { CustomActiveShape } from "./active-shape";
import { CustomPieChartTooltip } from "./tooltip";

export const PieChart = React.memo(function PieChart<K extends string, T extends string>(props: TPieChartProps<K, T>) {
  const {
    data,
    dataKey,
    cells,
    className,
    innerRadius,
    legend,
    margin,
    outerRadius,
    showTooltip = true,
    showLabel,
    customLabel,
    centerLabel,
    cornerRadius,
    paddingAngle,
    tooltipLabel,
  } = props;
  // states
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeLegend, setActiveLegend] = useState<string | null>(null);

  const renderCells = useMemo(
    () =>
      cells.map((cell, index) => (
        <Cell
          key={cell.key}
          className="transition-opacity duration-200"
          fill={cell.fill}
          opacity={!!activeLegend && activeLegend !== cell.key ? 0.1 : 1}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
        />
      )),
    [activeLegend, cells]
  );

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <CorePieChart
          data={data}
          margin={{
            top: margin?.top === undefined ? 5 : margin.top,
            right: margin?.right === undefined ? 30 : margin.right,
            bottom: margin?.bottom === undefined ? 5 : margin.bottom,
            left: margin?.left === undefined ? 20 : margin.left,
          }}
        >
          <Pie
            activeIndex={activeIndex === null ? undefined : activeIndex}
            onMouseLeave={() => setActiveIndex(null)}
            data={data}
            dataKey={dataKey}
            cx="50%"
            cy="50%"
            blendStroke
            activeShape={<CustomActiveShape />}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            cornerRadius={cornerRadius}
            paddingAngle={paddingAngle}
            labelLine={false}
            label={
              showLabel
                ? (props: PieLabelRenderProps) => {
                    const payload: unknown = props.payload;
                    const count = readField(payload, "count");
                    return (
                      <text
                        className="text-sm font-medium transition-opacity duration-200"
                        cx={props.cx}
                        cy={props.cy}
                        x={props.x}
                        y={props.y}
                        textAnchor={toTextAnchor(props.textAnchor)}
                        dominantBaseline={toDominantBaseline(readField(props, "dominantBaseline"))}
                        fill="var(--text-color-secondary)"
                        opacity={!!activeLegend && activeLegend !== readField(payload, "key") ? 0.1 : 1}
                      >
                        {customLabel?.(count) ?? toChartText(count)}
                      </text>
                    );
                  }
                : undefined
            }
          >
            {renderCells}
            {centerLabel && (
              <Label
                value={centerLabel.text}
                fill={centerLabel.fill}
                position="center"
                opacity={activeLegend ? 0.1 : 1}
                style={centerLabel.style}
                className={centerLabel.className}
              />
            )}
          </Pie>
          {legend && (
            <Legend
              onMouseEnter={(payload) => {
                const key = toChartKey(readField(payload.payload, "key"));
                if (!key) return;
                setActiveLegend(key);
                setActiveIndex(null);
              }}
              onMouseLeave={() => setActiveLegend(null)}
              {...getLegendProps(legend)}
            />
          )}
          {showTooltip && (
            <Tooltip
              cursor={{
                fill: "currentColor",
                className: "bg-layer-1-hover cursor-pointer",
              }}
              wrapperStyle={{
                pointerEvents: "none",
              }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const datum: unknown = payload[0].payload;
                const cellData = cells.find((c) => c.key === readField(datum, "key"));
                if (!cellData) return null;
                const tooltipPayload = readField(datum, "payload");
                const label = tooltipLabel
                  ? typeof tooltipLabel === "function"
                    ? tooltipLabel(isChartPayload(tooltipPayload) ? tooltipPayload : {})
                    : tooltipLabel
                  : dataKey;
                return <CustomPieChartTooltip dotColor={cellData.fill} label={label} payload={payload} />;
              }}
            />
          )}
        </CorePieChart>
      </ResponsiveContainer>
    </div>
  );
});
PieChart.displayName = "PieChart";
