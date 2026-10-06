// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { rejectNewlines } from "./single-line.js";

describe("rejectNewlines", () => {
  it("turns pasted newlines into spaces", () => {
    const state = EditorState.create({ doc: "priority", extensions: [rejectNewlines] });
    const next = state.update({ changes: { from: 8, insert: " =\nurgent\n" }, selection: { anchor: 18 } }).state;
    expect(next.doc.toString()).toBe("priority = urgent ");
    expect(next.doc.lines).toBe(1);
    expect(next.selection.main.head).toBe(18);
  });

  it("leaves single-line edits alone", () => {
    const state = EditorState.create({ doc: "a", extensions: [rejectNewlines] });
    expect(state.update({ changes: { from: 1, insert: " = 1" } }).state.doc.toString()).toBe("a = 1");
  });
});
