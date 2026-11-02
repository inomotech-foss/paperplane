// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { Schema } from "@tiptap/pm/model";
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap";
import { describe, expect, it } from "vitest";
import { extractTitleText } from "@/extensions/title-update/title-utils";

const schema = new Schema({
  nodes: {
    doc: { content: "heading" },
    heading: { content: "text*", attrs: { level: { default: 1 } } },
    text: {},
  },
  marks: { bold: {} },
});

const titleOf = (content: { type: "text"; text: string; marks?: { type: string }[] }[]) =>
  extractTitleText(
    prosemirrorJSONToYDoc(schema, { type: "doc", content: [{ type: "heading", content }] }, "title").getXmlFragment(
      "title"
    ),
    schema
  );

describe("extractTitleText", () => {
  it.each(["A & B", "AT&amp;T", "&lt;b&gt;", "<b>x</b>", "<script>"])("keeps the typed title %j", (text) => {
    expect(titleOf([{ type: "text", text }])).toBe(text);
  });

  it("drops formatting", () => {
    expect(
      titleOf([
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
        { type: "text", text: " title" },
      ])
    ).toBe("bold title");
  });

  it("returns an empty title for an empty heading", () => {
    expect(titleOf([])).toBe("");
  });
});
