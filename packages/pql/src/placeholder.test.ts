// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

// @vitest-environment jsdom

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { afterEach, describe, expect, it } from "vitest";

import { pql, pqlPlaceholder } from "./index.js";
import { vocabulary } from "./test-vocabulary.js";

const EXAMPLE = 'type = "Invoice" AND descendantOf("CUST-1")';
const TEXT = `Query, e.g. ${EXAMPLE}`;

const style = HighlightStyle.define([
  { tag: tags.keyword, class: "kw" },
  { tag: tags.function(tags.variableName), class: "fn" },
  { tag: tags.propertyName, class: "field" },
  { tag: tags.string, class: "str" },
  { tag: tags.operator, class: "op" },
  { tag: tags.punctuation, class: "punct" },
]);

let views: EditorView[] = [];

afterEach(() => {
  for (const view of views) view.destroy();
  views = [];
});

function editorFor(doc: string): EditorView {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      extensions: [syntaxHighlighting(style), pql({ vocabulary }), pqlPlaceholder(TEXT, EXAMPLE)],
    }),
  });
  views.push(view);
  return view;
}

const tokens = (root: Element) =>
  Array.from(root.querySelectorAll("span[class]"))
    .filter((span) => !span.className.startsWith("cm-"))
    .map((span) => [span.textContent, span.className]);

describe("pqlPlaceholder", () => {
  it("highlights the example with the same classes as typed input", () => {
    const empty = editorFor("");
    const example = empty.contentDOM.querySelector(".cm-placeholder .cm-pql-example");
    if (!example) throw new Error("no highlighted example");
    expect(example.textContent).toBe(EXAMPLE);
    expect(empty.contentDOM.querySelector(".cm-placeholder")?.textContent).toBe(TEXT);

    const typed = editorFor(EXAMPLE);
    const expected = tokens(typed.contentDOM);
    expect(expected.length).toBeGreaterThan(5);
    expect(tokens(example)).toEqual(expected);
  });

  it("hides on the first typed character", () => {
    const view = editorFor("");
    expect(view.contentDOM.querySelector(".cm-placeholder")).not.toBeNull();
    view.dispatch({ changes: { from: 0, insert: "t" } });
    expect(view.contentDOM.querySelector(".cm-placeholder")).toBeNull();
  });

  it("is hidden from screen readers, which get the text as aria-placeholder", () => {
    const view = editorFor("");
    expect(view.contentDOM.getAttribute("aria-placeholder")).toBe(TEXT);
    expect(view.contentDOM.querySelector(".cm-placeholder")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows text without the example unhighlighted", () => {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({ extensions: [syntaxHighlighting(style), pqlPlaceholder("Query", EXAMPLE)] }),
    });
    views.push(view);
    const shown = view.contentDOM.querySelector(".cm-placeholder");
    expect(shown?.textContent).toBe("Query");
    expect(shown?.querySelector(".cm-pql-example")).toBeNull();
  });
});
