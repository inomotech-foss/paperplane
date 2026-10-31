/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Markdown } from "tiptap-markdown";
import { describe, expect, it } from "vitest";

import { CustomCalloutExtensionConfig } from "@/extensions/callout/extension-config";
import { getCalloutBlockAttributes } from "@/extensions/callout/utils";
import { CustomImageExtensionConfig } from "@/extensions/custom-image/extension-config";
import { getCustomImageAttributes } from "@/extensions/custom-image/utils";
import { CustomMentionExtensionConfig } from "@/extensions/mentions/extension-config";
import { getMentionComponentAttributes } from "@/extensions/mentions/types";
import { CustomStarterKitExtension } from "@/extensions/starter-kit";

// Taken from apps/api/plane/seeds/data/issues.json.
const SEED_CALLOUT =
  '<div data-emoji-unicode="128161" data-emoji-url="https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4a1.png" data-logo-in-use="emoji" data-background="green" data-block-type="callout-component"><p class="editor-paragraph-block"><strong>Tip:</strong> Save time by using the keyboard shortcut <strong>C</strong> from anywhere in your project to quickly create a new work item!</p></div>';
const SEED_IMAGE =
  '<image-component src="https://media.docs.plane.so/seed_assets/51.png" aspectratio="4.489130434782608"></image-component>';

const createEditor = (content: string) =>
  new Editor({
    element: document.createElement("div"),
    extensions: [
      CustomStarterKitExtension({ enableHistory: false }),
      CustomCalloutExtensionConfig,
      CustomImageExtensionConfig,
      CustomMentionExtensionConfig,
      Markdown,
    ],
    content,
  });

const findNode = (editor: Editor, name: string): ProseMirrorNode => {
  let found: ProseMirrorNode | undefined;
  editor.state.doc.descendants((node) => {
    if (!found && node.type.name === name) found = node;
  });
  if (!found) throw new Error(`no ${name} node`);
  return found;
};

describe("callout attributes", () => {
  it("keeps the numeric emoji code from seed HTML", () => {
    const editor = createEditor(SEED_CALLOUT);
    const attrs = getCalloutBlockAttributes(findNode(editor, "calloutComponent").attrs);
    expect(attrs["data-emoji-unicode"]).toBe("128161");
    expect(attrs["data-emoji-url"]).toBe("https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4a1.png");
    expect(attrs["data-logo-in-use"]).toBe("emoji");
    expect(attrs["data-background"]).toBe("green");
    editor.destroy();
  });

  it("reads emoji codes that older documents stored as numbers", () => {
    const attrs = getCalloutBlockAttributes({ "data-emoji-unicode": 128204, "data-background": 7 });
    expect(attrs["data-emoji-unicode"]).toBe("128204");
    expect(attrs["data-background"]).toBe("7");
  });

  it("writes the emoji code into the markdown alt text", () => {
    const editor = createEditor(SEED_CALLOUT);
    const markdown: unknown = editor.storage.markdown.getMarkdown();
    expect(markdown).toContain(
      '> <img src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4a1.png" alt="128161" width="30px" />'
    );
    expect(markdown).not.toContain("undefined");
    editor.destroy();
  });
});

describe("image attributes", () => {
  it("reads the seed image source and aspect ratio", () => {
    const editor = createEditor(SEED_IMAGE);
    const attrs = getCustomImageAttributes(findNode(editor, "imageComponent").attrs);
    expect(attrs.src).toBe("https://media.docs.plane.so/seed_assets/51.png");
    expect(attrs.aspectRatio).toBeCloseTo(4.489130434782608);
    editor.destroy();
  });

  it("keeps a numeric width and height", () => {
    const editor = createEditor('<image-component src="a.png" width="300" height="200"></image-component>');
    const attrs = getCustomImageAttributes(findNode(editor, "imageComponent").attrs);
    expect(attrs.width).toBe(300);
    expect(attrs.height).toBe(200);
    editor.destroy();
  });
});

describe("mention attributes", () => {
  it("reads every mention attribute from HTML", () => {
    const editor = createEditor(
      '<p><mention-component id="7c1f0a3e-2b4d-4e8f-9a6b-1d2c3e4f5a6b" entity_identifier="0b8e3c1a-5f2d-4a7e-8c9b-6d5e4f3a2b1c" entity_name="user_mention"></mention-component></p>'
    );
    const attrs = getMentionComponentAttributes(findNode(editor, "mention").attrs);
    expect(attrs).toEqual({
      id: "7c1f0a3e-2b4d-4e8f-9a6b-1d2c3e4f5a6b",
      entity_identifier: "0b8e3c1a-5f2d-4a7e-8c9b-6d5e4f3a2b1c",
      entity_name: "user_mention",
      author: null,
    });
    editor.destroy();
  });
});
