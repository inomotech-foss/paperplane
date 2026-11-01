// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { toAutomation, toAutomationRun } from "./automation.service";

const automation: ApiSchema<"Automation"> = {
  id: "a1",
  workspace: "w1",
  project: "p1",
  scope: "project",
  applies_to_all_projects: false,
  projects: ["p1"],
  name: "A",
  description: "",
  trigger_type: "work_item.created",
  trigger_config: null,
  trigger_config_error: null,
  condition: { type: "condition", property: "priority", operator: "eq", value: "high" },
  is_enabled: true,
  next_run_at: null,
  last_run_at: null,
  last_run_status: null,
  total_run_count: 0,
  failed_run_count: 0,
  average_duration_ms: null,
  schedule_summary: null,
  owned_by: null,
  actions: [
    {
      id: "x1",
      automation: "a1",
      action_type: "add_comment",
      config: { comment_html: "<p>hi</p>" },
      config_error: "The comment body is empty.",
      sort_order: 1,
      created_at: "t",
      updated_at: "t",
      created_by: null,
    },
  ],
  created_at: "t",
  updated_at: "t",
  created_by: null,
  updated_by: null,
};

describe("toAutomation", () => {
  it("parses the condition, the trigger config and the action configs", () => {
    const result = toAutomation(automation);
    expect(result.trigger_config).toEqual({});
    expect(result.condition).toEqual({ type: "condition", property: "priority", operator: "eq", value: "high" });
    expect(result.actions[0]?.config).toEqual({ comment_html: "<p>hi</p>" });
    expect(result.actions[0]?.config_error).toBe("The comment body is empty.");
    expect(result.trigger_config_error).toBeNull();
  });
});

describe("unreadable values", () => {
  it("keeps the raw condition and action config instead of resetting them", () => {
    const condition = { type: "condition", property: "priority", operator: "eq", value: { a: 1 } };
    const config = { url: "https://a.example", headers: { n: 1 } };
    const action = { ...automation.actions[0], action_type: "call_webhook" as const, config };
    const result = toAutomation({ ...automation, condition, actions: [action] });
    expect(result.condition).toBeNull();
    expect(result.raw_condition).toEqual(condition);
    expect(result.actions[0]?.raw_config).toEqual(config);
    expect(toAutomation(automation).actions[0]).not.toHaveProperty("raw_config");
  });
});

describe("toAutomationRun", () => {
  it("parses the steps", () => {
    const run = toAutomationRun({
      id: "r1",
      automation: "a1",
      project: null,
      status: "success",
      trigger_source: "manual",
      trigger_type: "schedule",
      entity_type: "project",
      entity_identifier: null,
      initiator: null,
      started_at: "t",
      finished_at: null,
      duration_ms: 1,
      processed_count: 0,
      steps: "bad",
      error: "",
    });
    expect(run.steps).toEqual([]);
  });
});
