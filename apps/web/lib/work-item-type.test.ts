// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { getEffectiveTypeId, getWorkItemsOfType } from "./work-item-type";

const workItems = [
  { id: "invoice", project_id: "sales", type_id: "invoice-type", archived_at: null },
  { id: "untyped", project_id: "sales", type_id: null, archived_at: null },
  { id: "archived", project_id: "sales", type_id: null, archived_at: "2026-01-01" },
  { id: "other", project_id: "ops", type_id: null, archived_at: null },
];

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("getEffectiveTypeId", () => {
  it("falls back to the project default only when there is no type", () => {
    expect(getEffectiveTypeId("invoice-type", "task-type")).toBe("invoice-type");
    expect(getEffectiveTypeId(null, "task-type")).toBe("task-type");
    expect(getEffectiveTypeId(null, undefined)).toBeNull();
  });
});

describe("getWorkItemsOfType", () => {
  it("counts untyped work items as the project default type", () => {
    expect(ids(getWorkItemsOfType(workItems, "sales", "task-type", "task-type"))).toEqual(["untyped"]);
    expect(ids(getWorkItemsOfType(workItems, "sales", "invoice-type", "task-type"))).toEqual(["invoice"]);
  });

  it("matches no untyped work item when the project has no default", () => {
    expect(ids(getWorkItemsOfType(workItems, "sales", "task-type", null))).toEqual([]);
  });
});
