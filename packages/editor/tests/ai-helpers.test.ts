/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Editor } from "@tiptap/core";
import { Collaboration } from "@tiptap/extension-collaboration";
import { afterEach, describe, expect, it } from "vitest";
import { readField } from "@plane/types";
import { yUndoPluginKey } from "@tiptap/y-tiptap";
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
  snapRangeToText,
} from "@/helpers/ai";
import { getBinaryDataFromDocumentEditorHTMLString } from "@/helpers/yjs-utils";

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

const resolved = (tracker: ReturnType<typeof createRangeTracker>) => {
  const range = tracker.resolve();
  if (!range) throw new Error("the range did not resolve");
  return range;
};

// What a triple-click selects: the whole text of the paragraph.
const wholeParagraph = (instance: Editor) => ({ from: 1, to: instance.state.doc.child(0).nodeSize - 1 });

const firstIntoSecond = (i: Editor) => ({ from: rangeOf(i, "First").from, to: rangeOf(i, "Sec").to });

const setupCollaborative = async (
  content = "<p>Hello world</p>",
  pickRange: (instance: Editor) => { from: number; to: number } = (instance) => rangeOf(instance, "world")
) => {
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
  instance.commands.setContent(content);
  const tracker = createRangeTracker(instance, pickRange(instance));
  const remote = new Y.Doc();
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(ydoc));
  const paragraph = remote.getXmlFragment("default").get(0);
  const text = paragraph instanceof Y.XmlElement ? paragraph.get(0) : undefined;
  if (!(text instanceof Y.XmlText)) throw new Error("expected a text node");
  const sync = () => Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(ydoc)));
  return { instance, tracker, text, sync, remote };
};

describe("createRangeTracker on a collaborative document", () => {
  it("replaces a triple-click selection of a whole paragraph", async () => {
    const { instance, tracker } = await setupCollaborative("<p>Hello world</p><p>After</p>", wholeParagraph);
    replaceRangeWithHTML(instance, resolved(tracker), "<p>Replaced</p>");
    expect(htmlOf(instance)).toBe("<p>Replaced</p><p>After</p>");
  });

  it("inserts below a triple-click selection of a whole paragraph", async () => {
    const { instance, tracker } = await setupCollaborative("<p>Hello world</p><p>After</p>", wholeParagraph);
    insertHTMLBelowRange(instance, resolved(tracker), "<p>Added</p>");
    expect(htmlOf(instance)).toBe("<p>Hello world</p><p>Added</p><p>After</p>");
  });

  it("replaces a selection from a paragraph start to its middle", async () => {
    const { instance, tracker } = await setupCollaborative("<p>Hello world</p>", (i) => rangeOf(i, "Hello"));
    replaceRangeWithHTML(instance, resolved(tracker), "<p>Bye</p>");
    expect(instance.getText()).toBe("Bye world");
  });

  it("replaces and inserts below a selection from a paragraph start into the next paragraph", async () => {
    const replace = await setupCollaborative("<p>First</p><p>Second</p><p>Third</p>", firstIntoSecond);
    replaceRangeWithHTML(replace.instance, resolved(replace.tracker), "<p>New</p>");
    expect(htmlOf(replace.instance)).toBe("<p>Newond</p><p>Third</p>");
    replace.instance.destroy();

    const insert = await setupCollaborative("<p>First</p><p>Second</p><p>Third</p>", firstIntoSecond);
    insertHTMLBelowRange(insert.instance, resolved(insert.tracker), "<p>Added</p>");
    expect(htmlOf(insert.instance)).toBe("<p>First</p><p>Second</p><p>Added</p><p>Third</p>");
  });

  it("follows a remote edit before a paragraph-start selection", async () => {
    const { instance, tracker, remote, sync } = await setupCollaborative("<p>Intro</p><p>Hello world</p>", (i) =>
      rangeOf(i, "Hello world")
    );
    const intro = remote.getXmlFragment("default").get(0);
    const introText = intro instanceof Y.XmlElement ? intro.get(0) : undefined;
    if (!(introText instanceof Y.XmlText)) throw new Error("expected a text node");
    introText.insert(0, "Long ");
    sync();
    replaceRangeWithHTML(instance, resolved(tracker), "<p>Changed</p>");
    expect(htmlOf(instance)).toBe("<p>Long Intro</p><p>Changed</p>");
  });

  it("leaves a remote insert at the paragraph start outside a triple-click selection", async () => {
    const { instance, tracker, text, sync } = await setupCollaborative(
      "<p>Hello world</p><p>After</p>",
      wholeParagraph
    );
    text.insert(0, "Oh, ");
    sync();
    replaceRangeWithHTML(instance, resolved(tracker), "<p>Replaced</p>");
    expect(htmlOf(instance)).toBe("<p>Oh, Replaced</p><p>After</p>");
  });

  it("inserts below after a remote insert exactly at the start", async () => {
    const { instance, tracker, text, sync } = await setupCollaborative("<p>Hello world</p><p>After</p>");
    text.insert("Hello ".length, "big ");
    sync();
    const range = resolved(tracker);
    expect(instance.state.doc.textBetween(range.from, range.to)).toBe("world");
    insertHTMLBelowRange(instance, range, "<p>Added</p>");
    expect(htmlOf(instance)).toBe("<p>Hello big world</p><p>Added</p><p>After</p>");
  });

  it("leaves text inserted exactly at the start outside the range", async () => {
    const { instance, tracker, text, sync } = await setupCollaborative();
    text.insert("Hello ".length, "big ");
    sync();
    expect(instance.getText()).toBe("Hello big world");
    const range = tracker.resolve();
    if (!range) throw new Error("the range was lost");
    replaceRangeWithHTML(instance, range, "<p>there</p>");
    expect(instance.getText()).toBe("Hello big there");
  });

  it("leaves text inserted exactly at the end outside the range", async () => {
    const { instance, tracker, text, sync } = await setupCollaborative();
    text.insert("Hello world".length, "!");
    sync();
    const range = tracker.resolve();
    if (!range) throw new Error("the range was lost");
    expect(instance.state.doc.textBetween(range.from, range.to)).toBe("world");
  });

  it("resolves to null when a collaborator deletes the text", async () => {
    const { instance, tracker, text, sync } = await setupCollaborative();
    text.delete("Hello ".length, "world".length);
    sync();
    expect(instance.getText()).toBe("Hello ");
    expect(tracker.resolve()).toBeNull();
  });
});

describe("createRangeTracker after a collaborative undo", () => {
  it("keeps a remote insert at the paragraph start outside the range when the start was restored by undo", async () => {
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, getBinaryDataFromDocumentEditorHTMLString("<p>Delta paragraph rest</p><p>After</p>"));
    const instance = new Editor({
      element: document.createElement("div"),
      extensions: [
        CustomStarterKitExtension({ enableHistory: false }),
        Collaboration.configure({ document: ydoc, field: "default" }),
      ],
    });
    editor = instance;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(instance.getText()).toBe("Delta paragraph rest\n\nAfter");

    // tab A: replace the start of the paragraph, then undo it
    replaceRangeWithHTML(instance, rangeOf(instance, "Delta paragraph "), "<p>Mock</p>");
    expect(instance.getText()).toBe("Mockrest\n\nAfter");
    instance.commands.undo();
    expect(instance.getText()).toBe("Delta paragraph rest\n\nAfter");

    // tab A: select the whole paragraph and wait for the result
    const tracker = createRangeTracker(instance, { from: 1, to: instance.state.doc.child(0).nodeSize - 1 });

    // tab B: type at the start of the paragraph meanwhile
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(ydoc));
    const paragraph = remote.getXmlFragment("default").get(0);
    const text = paragraph instanceof Y.XmlElement ? paragraph.get(0) : undefined;
    if (!(text instanceof Y.XmlText)) throw new Error("expected a text node");
    text.insert(0, "B4-TYPED ");
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(ydoc)));
    expect(instance.getText()).toBe("B4-TYPED Delta paragraph rest\n\nAfter");

    const range = tracker.resolve();
    if (!range) throw new Error("the range did not resolve");
    expect(instance.state.doc.textBetween(range.from, range.to)).toBe("Delta paragraph rest");
    replaceRangeWithHTML(instance, range, "<p>Mock result</p>");
    expect(htmlOf(instance)).toBe("<p>B4-TYPED Mock result</p><p>After</p>");
  });
});

const connectedEditor = (ydoc: Y.Doc) =>
  new Editor({
    element: document.createElement("div"),
    extensions: [
      CustomStarterKitExtension({ enableHistory: false }),
      Collaboration.configure({ document: ydoc, field: "default" }),
    ],
  });

/** Ends the current undo step, so the next change becomes an undo step of its own. */
const stopUndoCapturing = (instance: Editor) => {
  const undoManager = readField(yUndoPluginKey.getState(instance.state), "undoManager");
  if (undoManager instanceof Y.UndoManager) undoManager.stopCapturing();
};

describe("createRangeTracker with two connected collaborative editors", () => {
  // y-tiptap turns typing into a character diff. Typing "B4-TYPED " before "Delta" credits the old "D"
  // to the typed text, so an anchor on that "D" alone would pull "D " into the range.
  it.each([1, 2, 3])(
    "keeps text typed by a collaborator at the paragraph start outside the range (run %i)",
    async (run) => {
      const docA = new Y.Doc();
      const docB = new Y.Doc();
      Y.applyUpdate(docA, getBinaryDataFromDocumentEditorHTMLString("<p>Delta paragraph rest of it</p><p>After</p>"));
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
      docA.on("update", (update: Uint8Array, origin: unknown) => {
        if (origin !== "remote") Y.applyUpdate(docB, update, "remote");
      });
      docB.on("update", (update: Uint8Array, origin: unknown) => {
        if (origin !== "remote") Y.applyUpdate(docA, update, "remote");
      });
      const a = connectedEditor(docA);
      const b = connectedEditor(docB);
      editor = a;
      await new Promise((resolve) => setTimeout(resolve, 0));

      for (let i = 0; i < run; i++) {
        stopUndoCapturing(a);
        replaceRangeWithHTML(a, rangeOf(a, "Delta paragraph "), "<p>Mock result </p>");
        stopUndoCapturing(a);
        a.commands.undo();
      }
      expect(a.getText()).toBe("Delta paragraph rest of it\n\nAfter");
      expect(b.getText()).toBe(a.getText());

      const tracker = createRangeTracker(a, { from: 1, to: a.state.doc.child(0).nodeSize - 1 });
      for (const [index, char] of [..."B4-TYPED "].entries()) {
        b.commands.insertContentAt(1 + index, char);
      }
      expect(a.getText()).toBe("B4-TYPED Delta paragraph rest of it\n\nAfter");

      const range = tracker.resolve();
      if (!range) throw new Error("the range did not resolve");
      replaceRangeWithHTML(a, range, "<p>Mock result</p>");
      expect(htmlOf(a)).toBe("<p>B4-TYPED Mock result</p><p>After</p>");
      expect(htmlOf(b)).toBe(htmlOf(a));
      b.destroy();
    },
    10000
  );
});

describe("snapRangeToText", () => {
  it("moves the range onto the nearest occurrence of the text and leaves it when the text is gone", () => {
    const instance = createEditor("<p>ab ab ab</p>");
    const { doc } = instance.state;
    // a range drifted one character left of the middle "ab" (positions 4 to 6)
    expect(snapRangeToText(doc, { from: 3, to: 5 }, "ab")).toEqual({ from: 4, to: 6 });
    expect(snapRangeToText(doc, { from: 3, to: 5 }, "zz")).toEqual({ from: 3, to: 5 });
    expect(snapRangeToText(doc, { from: 3, to: 5 }, "")).toEqual({ from: 3, to: 5 });
  });

  it("matches text across paragraphs", () => {
    const instance = createEditor("<p>One</p><p>Two</p>");
    const range = snapRangeToText(instance.state.doc, { from: 2, to: 8 }, "One\nTw");
    expect(range).toEqual({ from: 1, to: 8 });
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
