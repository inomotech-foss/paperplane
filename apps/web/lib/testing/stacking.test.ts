/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { findLinkOffsetParents, findStackingTraps } from "./stacking";

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

  it.each([
    "opacity-90",
    "transform",
    "z-10",
    "isolate",
    "scale-95",
    "hover:scale-105",
    "rotate-45",
    "-translate-x-1/2",
    "translate-y-px",
    "drop-shadow-md",
    "backdrop-blur-sm",
    "mix-blend-multiply",
    "will-change-transform",
    "sticky",
    "md:sticky",
    "fixed",
  ])("reports an ancestor with %s", (className) => {
    const card = element("relative isolate", element(`flex ${className}`, element("relative z-[2]")));
    expect(findStackingTraps(card)).toEqual([className]);
  });

  it.each(["z-auto", "relative", "shadow-md", "opacity"])("accepts an ancestor with %s", (className) => {
    const card = element("relative isolate", element(className, element("relative z-[2]")));
    expect(findStackingTraps(card)).toEqual([]);
  });

  it("ignores layers nested in a raised layer", () => {
    const card = element(
      "relative isolate",
      element("relative z-[2]", element("opacity-50", element("relative z-[2]")))
    );
    expect(findStackingTraps(card)).toEqual([]);
  });
});

describe("findLinkOffsetParents", () => {
  it("accepts a link whose ancestors up to the card are static", () => {
    const card = element("relative isolate", element("flex truncate", element("after:absolute after:inset-0")));
    expect(findLinkOffsetParents(card)).toEqual([]);
  });

  it.each(["relative", "absolute", "md:sticky"])("reports a %s element between the link and the card", (className) => {
    const card = element("relative isolate", element(`flex ${className}`, element("after:absolute after:inset-0")));
    expect(findLinkOffsetParents(card)).toEqual([className]);
  });
});
