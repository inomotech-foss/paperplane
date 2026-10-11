// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { toIntakeSettings } from "./intake-settings";

describe("toIntakeSettings", () => {
  it("sends the intake with the type of its submissions", () => {
    expect(toIntakeSettings({ intake: "intake-1", intake_issue_type: "bug" })).toEqual({
      intake: "intake-1",
      intake_issue_type: "bug",
    });
  });

  it("drops the type once submissions are off", () => {
    expect(toIntakeSettings({ intake: null, intake_issue_type: "bug" })).toEqual({
      intake: null,
      intake_issue_type: null,
    });
  });
});
