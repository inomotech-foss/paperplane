/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { CustomStarterKitExtension } from "@/extensions/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@/extensions/table";
import {
  getAllDocumentFormatsFromDocumentEditorBinaryData,
  getBinaryDataFromDocumentEditorHTMLString,
} from "@/helpers/yjs-utils";

// The shape the Confluence importer stores: header cells down the first
// column, a mapped cell background, a cell holding bare text.
const KEY_VALUE_TABLE =
  "<table><tbody>" +
  '<tr><th>Requirement</th><td background="var(--editor-colors-orange-background)"><p>The organization shall continually improve.</p></td></tr>' +
  "<tr><th>Instruction</th><td>Write down how your organization improves.</td></tr>" +
  "</tbody></table>";

const roundTrip = (html: string): JSONContent =>
  getAllDocumentFormatsFromDocumentEditorBinaryData(getBinaryDataFromDocumentEditorHTMLString(html), false)
    .contentJSON as JSONContent;

const cells = (doc: JSONContent): JSONContent[] =>
  (doc.content ?? []).flatMap((node) =>
    node.type === "table" ? (node.content ?? []).flatMap((row) => row.content ?? []) : []
  );

const attr = (node: JSONContent | undefined, name: string): unknown => node?.attrs?.[name];

const mount = (content: string): Editor =>
  new Editor({
    element: document.createElement("div"),
    editable: true,
    extensions: [CustomStarterKitExtension({ enableHistory: true }), Table, TableCell, TableHeader, TableRow],
    content,
  });

describe("table column widths", () => {
  it("leaves a cell without a colwidth unsized, through the binary document", () => {
    const parsed = cells(roundTrip(KEY_VALUE_TABLE));

    expect(parsed.map((cell) => cell.type)).toEqual(["tableHeader", "tableCell", "tableHeader", "tableCell"]);
    expect(parsed.map((cell) => attr(cell, "colwidth"))).toEqual([null, null, null, null]);
    expect(attr(parsed[1], "background")).toBe("var(--editor-colors-orange-background)");
  });

  it("keeps explicit widths, one per spanned column", () => {
    const parsed = cells(
      roundTrip(
        '<table><tbody><tr><th colwidth="200">Key</th><td colwidth="300,250" colspan="2"><p>v</p></td></tr></tbody></table>'
      )
    );

    expect(parsed.map((cell) => attr(cell, "colwidth"))).toEqual([[200], [300, 250]]);
  });

  it("drops a width list that does not match the span", () => {
    const parsed = cells(
      roundTrip('<table><tbody><tr><td colwidth="300" colspan="2"><p>v</p></td></tr></tbody></table>')
    );

    expect(attr(parsed[0], "colwidth")).toBeNull();
  });

  it("does not pin an unsized table to a fixed pixel width", () => {
    const editor = mount(KEY_VALUE_TABLE);
    const table = editor.view.dom.querySelector("table");

    // a fixed width here is what rendered every imported table at 2 x 150px
    expect(table?.style.width).toBe("");
    editor.destroy();
  });

  it("still sizes a table made in the editor", () => {
    const editor = mount("<p></p>");
    editor.commands.insertTable({ rows: 2, cols: 2 });
    const table = editor.view.dom.querySelector("table");

    expect(table?.style.width).toBe("300px");
    editor.destroy();
  });

  it("gives a sized key column its width and leaves the rest to the table", () => {
    const editor = mount(
      '<table><tbody><tr><th colwidth="200">Key</th><td><p>value</p></td></tr><tr><th colwidth="200">Key</th><td><p>value</p></td></tr></tbody></table>'
    );
    const cols = Array.from(editor.view.dom.querySelectorAll<HTMLTableColElement>("table col")).map(
      (col) => col.style.width
    );

    expect(cols).toEqual(["200px", ""]);
    editor.destroy();
  });
});

describe("query block include kind", () => {
  it("keeps an include block and the page it names through the binary document", () => {
    const doc = roundTrip('<query-block-component kind="include" root-page-id="p1"></query-block-component>');
    const block = (doc.content ?? []).find((node) => node.type === "query-block-component");

    expect(attr(block, "kind")).toBe("include");
    expect(attr(block, "root-page-id")).toBe("p1");
  });

  it("keeps an include block inside a table cell", () => {
    const doc = roundTrip(
      '<table><tbody><tr><th>Instruction</th><td><query-block-component kind="include" root-page-id="p1"></query-block-component></td></tr></tbody></table>'
    );
    const cell = cells(doc)[1];

    expect(cell.content?.[0]?.type).toBe("query-block-component");
    expect(attr(cell.content?.[0], "kind")).toBe("include");
  });
});
