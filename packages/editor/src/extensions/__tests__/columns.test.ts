/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { CORE_EXTENSIONS } from "@/constants/extension";
import { ColumnExtensionConfig, ColumnsExtensionConfig } from "../columns";

let editor: Editor;

afterEach(() => editor.destroy());

describe("insertColumns", () => {
  it("puts the cursor in the first column", () => {
    editor = new Editor({
      element: document.createElement("div"),
      content: "<p>before</p><p></p>",
      extensions: [StarterKit, ColumnsExtensionConfig, ColumnExtensionConfig],
    });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertColumns(3);

    const { $from } = editor.state.selection;
    const columnsDepth = [...Array($from.depth + 1).keys()].find(
      (depth) => $from.node(depth).type.name === CORE_EXTENSIONS.COLUMNS
    );
    expect(columnsDepth).toBeDefined();
    expect($from.index(columnsDepth)).toBe(0);
  });
});
