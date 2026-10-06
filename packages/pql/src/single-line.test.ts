// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { rejectNewlines } from "./single-line.js";

const stateOf = (doc: string) => EditorState.create({ doc, extensions: [rejectNewlines] });

describe("rejectNewlines", () => {
  it("turns pasted newlines into spaces at the end", () => {
    const next = stateOf("priority").update({
      changes: { from: 8, insert: " =\nurgent\n" },
      selection: { anchor: 18 },
    }).state;
    expect(next.doc.toString()).toBe("priority = urgent ");
    expect(next.doc.lines).toBe(1);
    expect(next.selection.main.head).toBe(18);
  });

  it("keeps the cursor where a paste at offset 0 leaves it", () => {
    const next = stateOf("= urgent").update({
      changes: { from: 0, insert: "priority\n" },
      selection: { anchor: 9 },
    }).state;
    expect(next.doc.toString()).toBe("priority = urgent");
    expect(next.selection.main.head).toBe(9);
  });

  it("keeps a mid-document cursor when a newline is typed there", () => {
    const next = stateOf("priority = urgent").update({
      changes: { from: 8, insert: "\n" },
      selection: { anchor: 9 },
    }).state;
    expect(next.doc.toString()).toBe("priority  = urgent");
    expect(next.selection.main.head).toBe(9);
  });

  it("leaves single-line edits alone", () => {
    expect(
      stateOf("a")
        .update({ changes: { from: 1, insert: " = 1" } })
        .state.doc.toString()
    ).toBe("a = 1");
  });
});
