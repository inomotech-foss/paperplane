/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// plane imports
import { Card } from "../../card/card";
import { readField } from "@plane/types";
import { toChartText } from "../payload";

interface TreeMapTooltipProps {
  active: boolean | undefined;
  payload: ReadonlyArray<{ payload?: unknown }> | undefined;
}

export const TreeMapTooltip = React.memo(function TreeMapTooltip({ active, payload }: TreeMapTooltipProps) {
  if (!active || !payload || !payload[0]?.payload) return null;

  const datum = payload[0].payload;
  const icon = readField(datum, "icon");
  const value = readField(datum, "value");
  const data = {
    icon: React.isValidElement(icon) ? icon : undefined,
    name: toChartText(readField(datum, "name")),
    value: typeof value === "number" ? value : undefined,
    label: toChartText(readField(datum, "label")),
  };

  return (
    <Card className="flex flex-col space-y-1.5" spacing="sm">
      <div className="flex items-center gap-2 border-b border-subtle pb-2.5">
        {data?.icon}
        <p className="text-11 font-medium text-primary capitalize">{data?.name}</p>
      </div>
      <span className="text-11 font-medium text-secondary">
        {data.value?.toLocaleString()}
        {data.label && ` ${data.label}`}
      </span>
    </Card>
  );
});

TreeMapTooltip.displayName = "TreeMapTooltip";
