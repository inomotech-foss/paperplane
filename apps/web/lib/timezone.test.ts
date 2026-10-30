// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { isTimezone, isUserTimezone } from "./timezone";

describe("timezone guards", () => {
  it("accepts timezones the API knows", () => {
    expect(isTimezone("UTC")).toBe(true);
    expect(isUserTimezone("Europe/Berlin")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isTimezone("Mars/Olympus")).toBe(false);
    expect(isUserTimezone(undefined)).toBe(false);
    expect(isUserTimezone(1)).toBe(false);
  });
});
