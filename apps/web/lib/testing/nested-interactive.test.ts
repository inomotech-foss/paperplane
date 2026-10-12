/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { findNestedInteractive } from "./nested-interactive";

// Built with DOM calls because the HTML parser would split nested links and buttons apart.
const element = (tag: string, attributes: Record<string, string> = {}, ...children: Element[]) => {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.append(...children);
  return node;
};

describe("findNestedInteractive", () => {
  it.each([
    ["a button in a link", element("a", { href: "/x" }, element("button"))],
    ["a link in a link", element("a", { href: "/x" }, element("span", {}, element("a", { href: "/y" })))],
    ["a button in a button", element("button", {}, element("button"))],
    ["a checkbox in a link", element("a", { href: "/x" }, element("input", { type: "checkbox" }))],
    ["a role button in a button", element("button", {}, element("span", { role: "button" }))],
  ])("reports %s", (_, tree) => {
    expect(findNestedInteractive(element("div", {}, tree))).toHaveLength(1);
  });

  it("accepts sibling controls and anchors without href", () => {
    const tree = element(
      "div",
      {},
      element("a", { href: "/x" }),
      element("button"),
      element("a", {}, element("button"))
    );
    expect(findNestedInteractive(tree)).toEqual([]);
  });
});
