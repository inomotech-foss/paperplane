/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { findStackingTraps } from "./stacking";

const element = (className: string, ...children: Element[]) => {
  const node = document.createElement("div");
  node.className = className;
  node.append(...children);
  return node;
};

describe("findStackingTraps", () => {
  it("accepts raised layers with plain ancestors", () => {
    const card = element("relative isolate", element("flex", element("relative z-[2]")));
    expect(findStackingTraps(card)).toEqual([]);
  });

  it.each(["opacity-90", "transform", "z-10", "isolate"])("reports an ancestor with %s", (className) => {
    const card = element("relative isolate", element(className, element("relative z-[2]")));
    expect(findStackingTraps(card)).toEqual([className]);
  });

  it("ignores layers nested in a raised layer", () => {
    const card = element(
      "relative isolate",
      element("relative z-[2]", element("opacity-50", element("relative z-[2]")))
    );
    expect(findStackingTraps(card)).toEqual([]);
  });
});
