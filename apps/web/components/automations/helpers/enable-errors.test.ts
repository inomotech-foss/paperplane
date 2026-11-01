// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { describeEnableErrors, parseEnableErrors } from "./enable-errors";

describe("parseEnableErrors", () => {
  it("reads the trigger and per-action reasons", () => {
    const errors = parseEnableErrors({
      trigger_config: ["The cron expression is empty."],
      actions: { a1: { config: ["The comment body is empty."] }, a2: { config: "not a list" }, a3: "bad" },
    });

    expect(errors).toEqual({
      messages: [],
      trigger: "The cron expression is empty.",
      actions: { a1: "The comment body is empty.", a2: "not a list" },
    });
    expect(describeEnableErrors(errors)).toBe("The cron expression is empty.");
  });

  it("keeps every reason that belongs to no card for the toast", () => {
    const errors = parseEnableErrors({
      is_enabled: ["An automation needs a trigger and at least one action before it can be enabled."],
      project_ids: ["Select the projects this automation should run on."],
      actions: { a1: { config: ["The comment body is empty."] } },
    });

    expect(describeEnableErrors(errors)).toBe(
      "An automation needs a trigger and at least one action before it can be enabled. " +
        "Select the projects this automation should run on."
    );
  });

  it("shows the text of an error or detail body and of unknown keys", () => {
    expect(describeEnableErrors(parseEnableErrors({ error: "Automation not found." }))).toBe("Automation not found.");
    expect(describeEnableErrors(parseEnableErrors({ detail: "Not allowed." }))).toBe("Not allowed.");
    expect(describeEnableErrors(parseEnableErrors({ condition: ["Bad condition."] }))).toBe("Bad condition.");
  });

  it("returns nothing for a body it can't read", () => {
    const errors = parseEnableErrors("Server error");

    expect(errors).toEqual({ messages: [], trigger: undefined, actions: {} });
    expect(describeEnableErrors(errors)).toBeUndefined();
  });
});
