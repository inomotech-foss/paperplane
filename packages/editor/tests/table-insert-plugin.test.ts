/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomStarterKitExtension } from "@/extensions/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@/extensions/table";

const TABLE_CONTENT = "<table><tbody><tr><th>head</th></tr><tr><td>cell</td></tr></tbody></table>";

const mountEditor = (): Editor =>
  new Editor({
    element: document.createElement("div"),
    editable: true,
    extensions: [CustomStarterKitExtension({ enableHistory: true }), Table, TableCell, TableHeader, TableRow],
    content: TABLE_CONTENT,
  });

describe("TableInsertPlugin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds the insert buttons to a table", () => {
    const editor = mountEditor();
    vi.runAllTimers();

    const table = editor.view.dom.querySelector("table");
    expect(table?.querySelectorAll("button").length).toBeGreaterThan(0);

    editor.destroy();
  });

  it("skips its deferred first run when the editor is destroyed before it lands", () => {
    // The run reads positions off the view, which throws once the view is gone. Version history
    // mounts and drops editors fast enough to hit this.
    const editor = mountEditor();
    editor.destroy();

    expect(() => vi.runAllTimers()).not.toThrow();
  });
});
