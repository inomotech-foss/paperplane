// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseAutomationActionConfig,
  parseAutomationCondition,
  parseAutomationRunSteps,
  parseAutomationTriggerConfig,
} from "./automation-parse";
import { resetClientJsonWarnings } from "./client-json/parse";

beforeEach(() => {
  resetClientJsonWarnings();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("parseAutomationCondition", () => {
  it("keeps a valid tree and the keys it does not know", () => {
    const tree = {
      type: "group",
      logical_operator: "and",
      children: [{ type: "condition", property: "priority", operator: "in", value: ["high"], extra: 1 }],
    };
    expect(parseAutomationCondition(tree)).toEqual(tree);
  });

  it("gives null for no condition and for a tree it cannot read", () => {
    expect(parseAutomationCondition(null)).toBeNull();
    expect(parseAutomationCondition({ type: "condition", property: "p", operator: "like" })).toBeNull();
  });
});

describe("parseAutomationTriggerConfig", () => {
  it("keeps an object and drops anything else", () => {
    expect(parseAutomationTriggerConfig({ mode: "cron", cron: "0 9 * * 1" })).toEqual({
      mode: "cron",
      cron: "0 9 * * 1",
    });
    expect(parseAutomationTriggerConfig("x")).toEqual({});
  });
});

describe("parseAutomationActionConfig", () => {
  it("reads the config of its action type", () => {
    expect(parseAutomationActionConfig("add_comment", { comment_html: "<p>hi</p>" })).toEqual({
      comment_html: "<p>hi</p>",
    });
    expect(parseAutomationActionConfig("archive_work_item", null)).toEqual({});
  });

  it("gives an empty config when it cannot read it", () => {
    expect(parseAutomationActionConfig("call_webhook", { method: "GET" })).toEqual({});
  });
});

describe("parseAutomationRunSteps", () => {
  it("drops the steps it cannot read and defaults the texts", () => {
    const steps = [
      { action_id: "a", action_type: "add_comment", status: "success" },
      { action_id: "b", action_type: "teleport", status: "success" },
    ];
    expect(parseAutomationRunSteps(steps)).toEqual([
      { action_id: "a", action_type: "add_comment", status: "success", detail: "", error: "" },
    ]);
    expect(parseAutomationRunSteps(undefined)).toEqual([]);
  });
});
