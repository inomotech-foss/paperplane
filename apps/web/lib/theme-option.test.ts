// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { getThemeOption } from "./theme-option";

describe("getThemeOption", () => {
  it("prefers the saved theme", () => {
    expect(getThemeOption("dark", "light")?.value).toBe("dark");
  });

  it("falls back to the theme in use", () => {
    expect(getThemeOption("", "system")?.value).toBe("system");
    expect(getThemeOption(undefined, "light")?.value).toBe("light");
  });

  it("returns null for an unknown theme", () => {
    expect(getThemeOption(undefined, undefined)).toBeNull();
  });
});
