// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { findOffScaleZIndexClasses } from "./z-index-scale.mjs";

describe("findOffScaleZIndexClasses", () => {
  it("allows local values and named layers", () => {
    expect(findOffScaleZIndexClasses("relative z-0 z-10 -z-1 hover:z-5 z-auto z-header md:z-popover")).toEqual([]);
  });

  it("flags arbitrary values", () => {
    expect(findOffScaleZIndexClasses("absolute z-[1] !z-[999999] md:z-[var(--x)]")).toEqual([
      "z-[1]",
      "!z-[999999]",
      "md:z-[var(--x)]",
    ]);
  });

  it("flags bare values above the local range", () => {
    expect(findOffScaleZIndexClasses("z-11 group-hover:z-50 z-20!")).toEqual(["z-11", "group-hover:z-50", "z-20!"]);
  });

  it("ignores text that only looks similar", () => {
    expect(findOffScaleZIndexClasses("size-20 gap-z-20 zoom-50 z-index")).toEqual([]);
  });
});
