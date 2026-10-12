// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { highlightingFor } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";
import { EditorView, placeholder } from "@codemirror/view";

import { highlightTokens } from "./highlight.js";

function highlighted(state: EditorState, text: string, example: string): HTMLElement {
  const root = document.createElement("span");
  const start = example ? text.indexOf(example) : -1;
  if (start < 0) {
    root.textContent = text;
    return root;
  }
  root.append(text.slice(0, start));
  const query = document.createElement("span");
  query.className = "cm-pql-example";
  let at = 0;
  for (const { token, tag } of highlightTokens(example)) {
    const cls = highlightingFor(state, [tag]);
    if (!cls) continue;
    const part = document.createElement("span");
    part.className = cls;
    part.textContent = example.slice(token.start, token.stop + 1);
    query.append(example.slice(at, token.start), part);
    at = token.stop + 1;
  }
  query.append(example.slice(at));
  root.append(query, text.slice(start + example.length));
  return root;
}

/**
 * A placeholder whose `example` query, wherever it appears in `text`, is highlighted like typed input and
 * dimmed. The copy is hidden from screen readers, which get `text` through `aria-placeholder` instead.
 */
export function pqlPlaceholder(text: string, example: string): Extension {
  return [
    placeholder((view) => highlighted(view.state, text, example)),
    EditorView.contentAttributes.of({ "aria-placeholder": text }),
    EditorView.baseTheme({ ".cm-pql-example": { opacity: "0.6" } }),
  ];
}
