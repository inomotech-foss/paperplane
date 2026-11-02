// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { RuleTester } from "oxlint/plugins-dev";
import { describe, expect, it } from "vitest";
import { findOffScaleZIndexClasses, isOffScaleZIndexValue, zIndexScale } from "./z-index-scale.mjs";

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

  it("flags variable shorthands, arbitrary properties and cut-off arbitrary values", () => {
    expect(findOffScaleZIndexClasses("z-(--layer) md:[z-index:99] !z-[")).toEqual([
      "z-(--layer)",
      "md:[z-index:99]",
      "!z-[",
    ]);
  });

  it("flags bare values above the local range", () => {
    expect(findOffScaleZIndexClasses("z-11 group-hover:z-50 z-20!")).toEqual(["z-11", "group-hover:z-50", "z-20!"]);
  });

  it("ignores text that only looks similar", () => {
    expect(findOffScaleZIndexClasses("size-20 gap-z-20 zoom-50 z-index")).toEqual([]);
  });
});

describe("isOffScaleZIndexValue", () => {
  it("allows local values, keywords and named layers", () => {
    for (const value of [0, 10, -1, "5", " 10 ", "auto", "var(--z-index-popover)", "calc(var(--z-index-floating) - 1)"])
      expect(isOffScaleZIndexValue(value)).toBe(false);
  });

  it("flags values above the local range and other strings", () => {
    for (const value of [11, 100, "50", "9999", "var(--layer)", "calc(100 - 1)"])
      expect(isOffScaleZIndexValue(value)).toBe(true);
  });

  it("ignores values it cannot read", () => {
    expect(isOffScaleZIndexValue(undefined)).toBe(false);
    expect(isOffScaleZIndexValue(null)).toBe(false);
  });
});

RuleTester.describe = describe;
RuleTester.it = it;

new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } }).run("z-index-scale", zIndexScale, {
  valid: [
    "const a = <div style={{ zIndex: 9 }} />;",
    'const a = <div style={{ ...floatingStyles, zIndex: "var(--z-index-floating)" }} />;',
    "const a = { zIndex: `calc(var(--z-index-floating) - 1)` };",
    "const a = { zIndex: layer, [zIndex]: 100 };",
    "node.style.zIndex = String(value);",
    'node.style.setProperty("z-index", "auto");',
    "const { zIndex = 100 } = props;",
  ],
  invalid: [
    {
      code: "const a = <div style={{ zIndex: 100 }} />;",
      errors: [
        {
          message:
            "z-index 100 is off the z-index scale. Use 0 to 10 under an isolated parent, or a named layer such as var(--z-index-popover).",
        },
      ],
    },
    { code: 'const a = { "z-index": "50", zIndex: -20 };', errors: 1 },
    { code: "const theme = { tooltip: { zIndex: `999` } };", errors: 1 },
    { code: 'node.style.zIndex = "120";', errors: 1 },
    { code: 'node.style["zIndex"] = 99;', errors: 1 },
    { code: 'node.style.setProperty("z-index", "1000");', errors: 1 },
  ],
});
