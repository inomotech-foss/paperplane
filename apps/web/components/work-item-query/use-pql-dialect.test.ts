// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { effectiveDialect } from "./use-pql-dialect";

describe("effectiveDialect", () => {
  it("follows the workspace when the member has no dialect", () => {
    expect(effectiveDialect(null, "plane")).toBe("plane");
  });

  it("prefers the member's own dialect", () => {
    expect(effectiveDialect("jql", "plane")).toBe("jql");
    expect(effectiveDialect("plane", "jql")).toBe("plane");
  });

  it("falls back to jql before anything has loaded", () => {
    expect(effectiveDialect(undefined, undefined)).toBe("jql");
  });
});
