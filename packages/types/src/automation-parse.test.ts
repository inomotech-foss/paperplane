// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import {
  parseAutomationActionConfig,
  parseAutomationCondition,
  parseAutomationRunSteps,
  parseAutomationTriggerConfig,
} from "./automation-parse";

describe("parseAutomationCondition", () => {
  it("keeps a valid tree and the keys it does not know", () => {
    const tree = {
      type: "group",
      logical_operator: "and",
      children: [{ type: "condition", property: "priority", operator: "in", value: ["high"], extra: 1 }],
    };
    expect(parseAutomationCondition(tree)).toEqual(tree);
  });

  it("reads what the backend accepts: no type, no children and an upper-case operator", () => {
    expect(parseAutomationCondition({ logical_operator: "AND" })).toEqual({
      type: "group",
      logical_operator: "and",
      children: [],
    });
  });

  it("gives null for no condition", () => {
    expect(parseAutomationCondition(null)).toBeNull();
  });

  it("gives undefined for a tree it cannot edit, so the caller keeps the raw value", () => {
    const leaf = { type: "condition", property: "priority", operator: "eq" };
    expect(parseAutomationCondition({ ...leaf, value: { nested: true } })).toBeUndefined();
    expect(parseAutomationCondition({ ...leaf, value: ["a", 1] })).toBeUndefined();
    expect(parseAutomationCondition({ children: [{ ...leaf, operator: "like" }] })).toBeUndefined();
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
  it("defaults the change type to set, as the backend does", () => {
    expect(parseAutomationActionConfig("change_property", { property: "priority", value: "high", note: 1 })).toEqual({
      property: "priority",
      change_type: "set",
      value: "high",
      note: 1,
    });
  });

  it("reads a lower-case webhook method and keeps the headers and payload", () => {
    const config = { url: "https://a.example", method: "post", headers: { "X-A": "1" }, payload: "{}", retry: 2 };
    expect(parseAutomationActionConfig("call_webhook", config)).toEqual({ ...config, method: "POST" });
  });

  it("leaves a webhook with a non-string header value to the raw value", () => {
    expect(
      parseAutomationActionConfig("call_webhook", { url: "https://a.example", headers: { n: 1 } })
    ).toBeUndefined();
  });

  it("reads a null title or message as absent", () => {
    expect(
      parseAutomationActionConfig("send_notification", { recipients: ["assignees"], title: null, message: "Hi" })
    ).toEqual({ recipients: ["assignees"], message: "Hi" });
  });

  it("keeps an empty archive config and leaves one with keys to the raw value", () => {
    expect(parseAutomationActionConfig("archive_work_item", null)).toEqual({});
    expect(parseAutomationActionConfig("archive_work_item", { reason: "done" })).toBeUndefined();
  });

  it("gives undefined for a config it cannot read", () => {
    expect(parseAutomationActionConfig("add_comment", "text")).toBeUndefined();
    expect(parseAutomationActionConfig("change_property", { property: "p", change_type: "swap" })).toBeUndefined();
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
