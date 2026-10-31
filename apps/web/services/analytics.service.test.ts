// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import { ChartXAxisProperty } from "@plane/types";
import { peekProjectId, toAxis, toInsightRow } from "./analytics.service";

vi.mock("@/services/api-client", () => ({ apiClient: {} }));

const counts = {
  cancelled_work_items: 1,
  completed_work_items: 2,
  backlog_work_items: 3,
  un_started_work_items: 4,
  started_work_items: 5,
};

describe("toInsightRow", () => {
  it("keeps the project of a workspace row", () => {
    expect(toInsightRow({ ...counts, project_id: "p1", project__name: "P" })).toEqual({
      ...counts,
      project_id: "p1",
      project__name: "P",
    });
  });

  it("keeps the assignee of a project row and leaves out its null fields", () => {
    const row = { ...counts, display_name: null, assignee_id: null, avatar_url: null };
    expect(toInsightRow(row)).toEqual(counts);
    expect(toInsightRow({ ...row, display_name: "Ann", assignee_id: "u1" })).toEqual({
      ...counts,
      display_name: "Ann",
      assignee_id: "u1",
    });
  });
});

describe("toAxis", () => {
  it("keeps the axes the backend reads", () => {
    expect(toAxis(ChartXAxisProperty.PRIORITY)).toBe("PRIORITY");
  });

  it("throws for an axis the backend would draw as priority", () => {
    expect(() => toAxis(ChartXAxisProperty.WORK_ITEM_TYPES)).toThrow();
  });
});

describe("peekProjectId", () => {
  it("reads the first project and requires one", () => {
    expect(peekProjectId({ project_ids: "p1,p2" })).toBe("p1");
    expect(() => peekProjectId({ project_ids: " " })).toThrow();
    expect(() => peekProjectId(undefined)).toThrow();
  });
});
