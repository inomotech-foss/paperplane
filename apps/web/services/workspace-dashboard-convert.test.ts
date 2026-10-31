// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import {
  toDashboard,
  toDimension,
  toWidget,
  toWidgetCreateBody,
  toWidgetData,
  toWidgetDatum,
} from "./workspace-dashboard-convert";

const dashboard: ApiSchema<"Dashboard"> = {
  id: "d1",
  is_owner: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  name: "Board",
  description: "",
  logo_props: { in_use: 3 },
  access: 1,
  sort_order: 1,
  created_by: null,
  updated_by: null,
  workspace: "w1",
  owned_by: "u1",
};

const widget: ApiSchema<"DashboardWidget"> = {
  id: "x1",
  metric: { function: "sum", field: "estimate_points" },
  dimension: { field: "created_at", bucket: "week" },
  series: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  title: "Points",
  description: "",
  query: "",
  chart_type: "bar",
  config: { width: "full" },
  sort_order: 1,
  created_by: null,
  updated_by: null,
  dashboard: "d1",
  workspace: "w1",
};

describe("toDashboard", () => {
  it("falls back for a malformed logo and leaves out the widget count when it is not sent", () => {
    const result = toDashboard(dashboard);
    expect(result.logo_props).toEqual({ in_use: "emoji" });
    expect("widget_count" in result).toBe(false);
    expect(toDashboard({ ...dashboard, widget_count: 2 }).widget_count).toBe(2);
  });
});

describe("toWidget", () => {
  it("keeps the definition and the client-owned config", () => {
    expect(toWidget(widget)).toMatchObject({
      metric: { function: "sum", field: "estimate_points" },
      dimension: { field: "created_at", bucket: "week" },
      series: {},
      config: { width: "full" },
    });
  });

  it("maps a dimension without a field to the empty object", () => {
    expect(toDimension({ bucket: "day" })).toEqual({});
    expect(toDimension({ field: "state" })).toEqual({ field: "state" });
  });
});

describe("toWidgetData", () => {
  it("draws null aggregates as 0 and keeps a null total", () => {
    expect(toWidgetDatum({ key: "k", name: "K", count: null, s1: null, s2: 3 })).toEqual({
      key: "k",
      name: "K",
      count: 0,
      s1: 0,
      s2: 3,
    });
    const data = toWidgetData({
      data: [],
      schema: {},
      total: null,
      row_count: 0,
      metric: { function: "avg", field: "property:p" },
      dimension: {},
      series: {},
    });
    expect(data.total).toBeNull();
    expect(data.metric).toEqual({ function: "avg", field: "property:p" });
  });
});

describe("toWidgetCreateBody", () => {
  it("sends the definition, the title and the config only", () => {
    const body = toWidgetCreateBody({ ...toWidget(widget), title: "T" });
    expect(Object.keys(body).sort()).toEqual(
      ["chart_type", "config", "description", "dimension", "metric", "query", "series", "title"].sort()
    );
  });
});
