/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

import { CustomStarterKitExtension } from "@/extensions/starter-kit";
import {
  DocumentEditorAdditionalExtensions,
  type TDocumentEditorAdditionalExtensionsProps,
} from "@/extensions/document-extensions";
import type { TFileHandler } from "@/types";

// This suite is only about which extensions get registered, so the handlers do nothing.
const renderNothing = () => null;

const fileHandler: TFileHandler = {
  assetsUploadStatus: {},
  cancel: () => {},
  checkIfAssetExists: () => Promise.resolve(false),
  delete: () => Promise.resolve(),
  getAssetDownloadSrc: () => Promise.resolve(""),
  getAssetSrc: () => Promise.resolve(""),
  restore: () => Promise.resolve(),
  upload: () => Promise.resolve(""),
  duplicate: () => Promise.resolve(""),
  validation: { maxFileSize: 0 },
};

const props = (
  overrides: Partial<TDocumentEditorAdditionalExtensionsProps> = {}
): TDocumentEditorAdditionalExtensionsProps => ({
  childPagesHandler: { renderComponent: renderNothing },
  diagramHandler: { renderEditor: renderNothing },
  embedHandler: { renderComponent: renderNothing },
  fileHandler,
  pageAttachmentsHandler: { renderComponent: renderNothing },
  queryBlockHandler: { renderComponent: renderNothing },
  workItemEmbedHandler: { renderComponent: renderNothing },
  disabledExtensions: [],
  flaggedExtensions: [],
  extendedEditorProps: {},
  isEditable: false,
  userDetails: { id: "user-1", name: "Test User", color: "#000000" },
  ...overrides,
});

const names = (extensions: ReturnType<typeof DocumentEditorAdditionalExtensions>) =>
  extensions.map((extension) => extension.name);

// A stand-in for HocuspocusProvider: the cursor extension only needs awareness.
const provider = { awareness: new Awareness(new Y.Doc()) };

describe("DocumentEditorAdditionalExtensions", () => {
  it("leaves out the collaboration cursor when there is no provider", () => {
    // A page version renders read-only with no Hocuspocus connection; the cursor
    // extension would dereference provider.awareness and throw on editor creation.
    expect(names(DocumentEditorAdditionalExtensions(props()))).not.toContain("collaborationCaret");
  });

  it("adds the collaboration cursor once a provider is connected", () => {
    const extensions = DocumentEditorAdditionalExtensions(props({ provider, isEditable: true }));
    expect(names(extensions)).toContain("collaborationCaret");
  });

  it("honours the collaboration-cursor disabled flag even with a provider", () => {
    const extensions = DocumentEditorAdditionalExtensions(
      props({ provider, disabledExtensions: ["collaboration-cursor"] })
    );
    expect(names(extensions)).not.toContain("collaborationCaret");
  });

  it("mounts a provider-less editor, as a page version does", () => {
    // Membership assertions alone would not catch this: the throw happens when an extension
    // builds its ProseMirror plugins, which only occurs once an editor is actually created.
    const editor = new Editor({
      element: document.createElement("div"),
      editable: false,
      extensions: [CustomStarterKitExtension({ enableHistory: true }), ...DocumentEditorAdditionalExtensions(props())],
      content: "<p>version content</p>",
    });

    expect(editor.getText()).toBe("version content");
    editor.destroy();
  });

  it("keeps every other extension in place without a provider", () => {
    const withProvider = names(DocumentEditorAdditionalExtensions(props({ provider })));
    const without = names(DocumentEditorAdditionalExtensions(props()));
    expect(withProvider.filter((name) => name !== "collaborationCaret")).toEqual(without);
  });
});
