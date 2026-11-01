/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { CustomStarterKitExtension } from "@/extensions/starter-kit";
import { getSelectionMarkdown, insertHTMLBelowRange, mapRange, replaceRangeWithHTML } from "@/helpers/ai";

let editor: Editor | undefined;

const createEditor = (content: string) => {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [CustomStarterKitExtension({ enableHistory: false })],
    content,
  });
  return editor;
};

/** The document range of the first occurrence of `text`. */
const rangeOf = (instance: Editor, text: string) => {
  let found: { from: number; to: number } | undefined;
  instance.state.doc.descendants((node, pos) => {
    if (found || !node.isText || !node.text) return;
    const index = node.text.indexOf(text);
    if (index >= 0) found = { from: pos + index, to: pos + index + text.length };
  });
  if (!found) throw new Error(`"${text}" is not in the document`);
  return found;
};

/** The HTML without the class names the editor adds to every block. */
const htmlOf = (instance: Editor) => instance.getHTML().replace(/ class="[^"]*"/g, "");

afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

describe("getSelectionMarkdown", () => {
  it("keeps the formatting of the selection", () => {
    const instance = createEditor("<p>Intro</p><ul><li><p><strong>one</strong></p></li><li><p>two</p></li></ul>");
    instance.commands.setTextSelection({ from: rangeOf(instance, "one").from, to: rangeOf(instance, "two").to });
    const markdown = getSelectionMarkdown(instance, () => ({ file_assets: [], user_mentions: [] }));
    expect(markdown).toContain("**one**");
    expect(markdown).toMatch(/^[-*] /m);
    expect(markdown).not.toContain("Intro");
  });
});

describe("replaceRangeWithHTML", () => {
  it("puts a single paragraph inline", () => {
    const instance = createEditor("<p>Hello world, bye</p>");
    replaceRangeWithHTML(instance, rangeOf(instance, "world"), "<p><strong>Earth</strong></p>");
    expect(htmlOf(instance)).toBe("<p>Hello <strong>Earth</strong>, bye</p>");
  });

  it("puts several blocks in place of whole paragraphs", () => {
    const instance = createEditor("<p>Keep</p><p>Old text</p><p>End</p>");
    const { from, to } = rangeOf(instance, "Old text");
    replaceRangeWithHTML(instance, { from, to }, "<p>New one</p><ul><li><p>item</p></li></ul>");
    const html = htmlOf(instance);
    expect(html).toContain("<p>Keep</p>");
    expect(html).toContain("<p>New one</p>");
    expect(html).toContain("<li><p>item</p></li>");
    expect(html).toContain("<p>End</p>");
    expect(html).not.toContain("Old text");
  });
});

describe("insertHTMLBelowRange", () => {
  it("adds blocks after the block that ends the selection and keeps the selection", () => {
    const instance = createEditor("<p>First</p><p>Second</p>");
    insertHTMLBelowRange(instance, rangeOf(instance, "First"), "<p>Added</p>");
    expect(htmlOf(instance)).toBe("<p>First</p><p>Added</p><p>Second</p>");
  });

  it("adds blocks after a whole list when the selection is in a list item", () => {
    const instance = createEditor("<ul><li><p>one</p></li><li><p>two</p></li></ul><p>After</p>");
    insertHTMLBelowRange(instance, rangeOf(instance, "one"), "<p>Added</p>");
    expect(htmlOf(instance)).toMatch(/<\/ul><p>Added<\/p><p>After<\/p>$/);
  });

  it("clamps a range that is past the end of the document", () => {
    const instance = createEditor("<p>Only</p>");
    insertHTMLBelowRange(instance, { from: 100, to: 200 }, "<p>Added</p>");
    expect(htmlOf(instance)).toBe("<p>Only</p><p>Added</p>");
  });
});

describe("mapRange", () => {
  it("follows the selected text when content is added before it", () => {
    const instance = createEditor("<p>Hello world</p>");
    const range = rangeOf(instance, "world");
    let mapped = range;
    instance.on("transaction", ({ transaction }) => {
      mapped = mapRange(mapped, transaction.mapping);
    });
    instance.commands.insertContentAt(1, "Oh, ");
    expect(instance.state.doc.textBetween(mapped.from, mapped.to)).toBe("world");
    replaceRangeWithHTML(instance, mapped, "<p>there</p>");
    expect(htmlOf(instance)).toBe("<p>Oh, Hello there</p>");
  });
});
