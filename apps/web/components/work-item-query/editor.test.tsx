// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import QueryEditor from "./editor";

const EXAMPLE = 'type = "Invoice" AND state = "Paid" AND descendantOf("CUST-1")';
const PLACEHOLDER = `Query, e.g. ${EXAMPLE}`;

const renderEditor = (value: string) => {
  const { container } = render(
    <QueryEditor
      value={value}
      onChange={() => {}}
      placeholder={PLACEHOLDER}
      example={EXAMPLE}
      ariaLabel="Plane Query Language"
      hasError={false}
      vocabulary={{ fields: [], functions: [] }}
    />
  );
  const content = container.querySelector<HTMLElement>(".cm-content");
  if (!content) throw new Error("no editor content");
  return content;
};

const tokenClasses = (root: Element) =>
  Array.from(root.querySelectorAll("span[class]"))
    .filter((span) => !span.className.startsWith("cm-"))
    .map((span) => [span.textContent, span.className]);

describe("QueryEditor placeholder", () => {
  it("highlights the example with the classes of a typed query", () => {
    const example = renderEditor("").querySelector(".cm-placeholder .cm-pql-example");
    if (!example) throw new Error("no highlighted example");
    const typed = tokenClasses(renderEditor(EXAMPLE));
    expect(typed.length).toBeGreaterThan(10);
    expect(tokenClasses(example)).toEqual(typed);
  });

  it("hides once there is a query", () => {
    expect(renderEditor("").querySelector(".cm-placeholder")?.textContent).toBe(PLACEHOLDER);
    expect(renderEditor("t").querySelector(".cm-placeholder")).toBeNull();
  });

  it("keeps the placeholder text accessible and the decorative copy hidden", () => {
    const content = renderEditor("");
    expect(content.getAttribute("aria-label")).toBe("Plane Query Language");
    expect(content.getAttribute("aria-placeholder")).toBe(PLACEHOLDER);
    expect(content.querySelector(".cm-placeholder")?.getAttribute("aria-hidden")).toBe("true");
  });
});
