// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import {
  toCycle,
  toCycleCreateBody,
  toCycleDistribution,
  toCycleEstimateDistribution,
  toCycleEstimateSums,
  toCycleWriteBody,
  toProgressSnapshot,
} from "./cycle-convert";

const distribution: ApiSchema<"Distribution"> = {
  assignees: [{ assignee_id: "u1", display_name: "Ann", avatar_url: null, total_issues: 2, completed_issues: 1 }],
  labels: [{ label_id: null, label_name: null, color: null, total_estimates: 3, pending_estimates: null }],
  completion_chart: { "2026-01-01": 2, "2026-01-02": null },
};

const listItem: ApiSchema<"CycleListItem"> = {
  id: "c1",
  workspace_id: "w1",
  project_id: "p1",
  name: "Cycle",
  description: "",
  start_date: null,
  end_date: null,
  owned_by_id: "u1",
  view_props: {},
  sort_order: 1,
  external_source: null,
  external_id: null,
  progress_snapshot: {},
  is_favorite: true,
  total_issues: 4,
  completed_issues: 1,
  assignee_ids: ["u1"],
  status: "CURRENT",
  logo_props: { in_use: "icon", icon: { name: "x" } },
  version: 2,
  created_by: null,
  cancelled_issues: 0,
};

describe("toCycle", () => {
  it("keeps the fields of a list row and maps the status", () => {
    const cycle = toCycle(listItem);
    expect(cycle).toMatchObject({ id: "c1", status: "current", total_issues: 4, cancelled_issues: 0, version: 2 });
    expect(cycle.logo_props).toEqual({ in_use: "icon", icon: { name: "x" } });
    expect(cycle.progress_snapshot).toEqual({});
  });

  it("leaves out the fields a row does not send", () => {
    const { logo_props: _logo, version: _version, created_by: _creator, ...rest } = listItem;
    const workspaceRow: ApiSchema<"Cycle"> = { ...rest, logo_props: {}, status: "DRAFT" };
    const cycle = toCycle(workspaceRow);
    expect(cycle).not.toHaveProperty("version");
    expect(cycle).not.toHaveProperty("archived_at");
    expect(cycle).not.toHaveProperty("started_issues");
    expect(cycle.status).toBe("draft");
  });

  it("converts the distributions of an archived cycle", () => {
    const archived: ApiSchema<"ArchivedCycleDetail"> = {
      ...listItem,
      started_issues: null,
      unstarted_issues: 1,
      backlog_issues: 0,
      archived_at: "2026-01-01T00:00:00Z",
      sub_issues: 0,
      completed_estimate_points: null,
      total_estimate_points: 5,
      estimate_distribution: {},
      distribution,
    };
    const cycle = toCycle(archived);
    expect(cycle).toMatchObject({ started_issues: 0, unstarted_issues: 1, total_estimate_points: 5 });
    expect(cycle.completed_estimate_points).toBe(0);
    expect(cycle.estimate_distribution).toBeUndefined();
    expect(cycle.distribution?.assignees[0]).toMatchObject({ first_name: null, pending_issues: 0 });
  });
});

describe("distributions", () => {
  it("defaults the counts an endpoint leaves out", () => {
    expect(toCycleDistribution(distribution).labels[0]).toEqual({
      label_id: null,
      label_name: null,
      color: null,
      total_issues: 0,
      completed_issues: 0,
      pending_issues: 0,
    });
  });

  it("reads the estimate sums, and nothing for an empty estimate distribution", () => {
    expect(toCycleEstimateSums(distribution).labels[0]).toMatchObject({
      total_estimates: 3,
      pending_estimates: 0,
    });
    expect(toCycleEstimateDistribution({})).toBeUndefined();
  });

  it("keeps only the stored snapshot keys", () => {
    expect(toProgressSnapshot({ total_issues: 3, estimate_distribution: {} })).toEqual({ total_issues: 3 });
    expect(toProgressSnapshot({ distribution }).distribution?.assignees).toHaveLength(1);
    expect(toProgressSnapshot({ completed_estimate_points: 3, total_estimate_points: 8 })).toEqual({
      completed_estimate_points: 3,
      total_estimate_points: 8,
    });
  });
});

describe("cycle bodies", () => {
  it("sends only the writable fields", () => {
    const body = toCycleWriteBody({ ...toCycle(listItem), sort_order: 3 });
    const sent = Object.entries(body).filter(([, value]) => value !== undefined);
    expect(sent.map(([key]) => key).sort()).toEqual([
      "description",
      "end_date",
      "logo_props",
      "name",
      "sort_order",
      "start_date",
    ]);
    expect(toCycleCreateBody({}).name).toBe("");
  });
});
