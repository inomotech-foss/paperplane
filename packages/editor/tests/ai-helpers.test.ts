/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Editor } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";

import { CustomMentionExtensionConfig } from "@/extensions/mentions/extension-config";
import { CustomStarterKitExtension } from "@/extensions/starter-kit";
import {
  createRangeTracker,
  getSelectionMarkdown,
  hasNodesLostByMarkdown,
  insertHTMLBelowRange,
  mapRange,
  replaceRangeWithHTML,
} from "@/helpers/ai";

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

describe("hasNodesLostByMarkdown", () => {
  it("flags mentions but not plain formatting", () => {
    editor = new Editor({
      element: document.createElement("div"),
      extensions: [CustomStarterKitExtension({ enableHistory: false }), CustomMentionExtensionConfig],
      content:
        '<p><strong>Hi</strong><br>there</p><p>Ask <mention-component id="m1" entity_identifier="u1" entity_name="user_mention"></mention-component></p>',
    });
    const { doc } = editor.state;
    expect(hasNodesLostByMarkdown(doc.slice(0, doc.child(0).nodeSize))).toBe(false);
    expect(hasNodesLostByMarkdown(doc.slice(0, doc.content.size))).toBe(true);
  });
});

describe("mapRange", () => {
  it("returns null once the content is deleted", () => {
    const instance = createEditor("<p>Hello world</p>");
    const range = rangeOf(instance, "world");
    const tr = instance.state.tr.delete(range.from - 1, range.to);
    expect(mapRange(range, tr.mapping)).toBeNull();
  });
});

describe("createRangeTracker", () => {
  it("follows local edits before the range", () => {
    const instance = createEditor("<p>Hello world</p>");
    const tracker = createRangeTracker(instance, rangeOf(instance, "world"));
    const stop = tracker.start();
    instance.commands.insertContentAt(1, "Oh, ");
    const range = tracker.resolve();
    expect(range && instance.state.doc.textBetween(range.from, range.to)).toBe("world");
    stop();
  });

  it("gives up instead of jumping to the end when the whole document is replaced", () => {
    const instance = createEditor("<p>Hello world</p>");
    const tracker = createRangeTracker(instance, rangeOf(instance, "world"));
    const stop = tracker.start();
    const { tr, doc, schema } = instance.state;
    instance.view.dispatch(
      tr.replaceWith(0, doc.content.size, schema.nodes.paragraph.create(null, schema.text("Oh, Hello world")))
    );
    expect(tracker.resolve()).toBeNull();
    stop();
  });

  it("follows a remote Yjs update on a collaborative document", async () => {
    const ydoc = new Y.Doc();
    const instance = new Editor({
      element: document.createElement("div"),
      extensions: [
        CustomStarterKitExtension({ enableHistory: false }),
        Collaboration.configure({ document: ydoc, field: "default" }),
      ],
    });
    editor = instance;
    await new Promise((resolve) => setTimeout(resolve, 0));
    instance.commands.setContent("<p>Hello world</p>");
    const tracker = createRangeTracker(instance, rangeOf(instance, "world"));

    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(ydoc));
    const paragraph = remote.getXmlFragment("default").get(0);
    const text = paragraph instanceof Y.XmlElement ? paragraph.get(0) : undefined;
    if (!(text instanceof Y.XmlText)) throw new Error("expected a text node");
    text.insert(0, "Oh, ");
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(ydoc)));

    expect(instance.getText()).toBe("Oh, Hello world");
    const range = tracker.resolve();
    if (!range) throw new Error("the range was lost");
    expect(instance.state.doc.textBetween(range.from, range.to)).toBe("world");
    replaceRangeWithHTML(instance, range, "<p>there</p>");
    expect(instance.getText()).toBe("Oh, Hello there");
  });
});

describe("write guards", () => {
  it("does not write to a read-only editor", () => {
    const instance = createEditor("<p>Hello world</p>");
    instance.setEditable(false);
    expect(replaceRangeWithHTML(instance, rangeOf(instance, "world"), "<p>x</p>")).toBe(false);
    expect(insertHTMLBelowRange(instance, rangeOf(instance, "world"), "<p>x</p>")).toBe(false);
    expect(instance.getText()).toBe("Hello world");
  });
});
