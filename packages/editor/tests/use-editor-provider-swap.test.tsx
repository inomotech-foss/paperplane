/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { HocuspocusProvider } from "@hocuspocus/provider";
import { Collaboration } from "@tiptap/extension-collaboration";
import type { Editor } from "@tiptap/react";
import { act, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { useEditor } from "@/hooks/use-editor";
import { useYjsSetup } from "@/hooks/use-yjs-setup";
import type { TFileHandler } from "@/types";

const providerDocs: Y.Doc[] = [];
const persistedDocs: Y.Doc[] = [];

vi.mock("@hocuspocus/provider", () => ({
  HocuspocusProvider: class {
    document = new Y.Doc();
    configuration = { websocketProvider: { shouldConnect: true, disconnect() {}, connect() {} } };
    constructor() {
      providerDocs.push(this.document);
    }
    on() {}
    off() {}
    destroy() {}
  },
}));

// The full core extension set does not mount in jsdom. The swap only needs a schema.
vi.mock("@/extensions", async () => {
  const { CustomStarterKitExtension } = await import("@/extensions/starter-kit");
  return { CoreEditorExtensions: () => [CustomStarterKitExtension({ enableHistory: false })] };
});

vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: class {
    constructor(_name: string, doc: Y.Doc) {
      persistedDocs.push(doc);
    }
    on() {}
    off() {}
    destroy() {}
  },
}));

const fileHandler: TFileHandler = {
  assetsUploadStatus: {},
  cancel: () => {},
  checkIfAssetExists: async () => true,
  delete: async () => {},
  getAssetDownloadSrc: async (path) => path,
  getAssetSrc: async (path) => path,
  restore: async () => {},
  upload: async () => "",
  duplicate: async () => "",
  validation: { maxFileSize: 1024 },
};
const editorProps = {
  disabledExtensions: [],
  extendedEditorProps: {},
  flaggedExtensions: [],
  getEditorMetaData: () => ({ file_assets: [], user_mentions: [] }),
  id: "doc",
  mentionHandler: { renderComponent: () => null },
};

let currentEditor: Editor | null = null;
const setCurrentEditor = (editor: Editor | null) => {
  currentEditor = editor;
};

function CollabEditor({ provider }: { provider: HocuspocusProvider }) {
  const extensions = useMemo(
    () => [Collaboration.configure({ document: provider.document, field: "default" })],
    [provider]
  );
  const editor = useEditor({
    ...editorProps,
    editable: true,
    enableHistory: false,
    extensions,
    fileHandler,
    provider,
  });
  useEffect(() => setCurrentEditor(editor), [editor]);
  return null;
}

function Harness({ authToken }: { authToken: string }) {
  const setup = useYjsSetup({ docId: "doc", serverUrl: "ws://live", authToken });
  return setup ? <CollabEditor provider={setup.provider} /> : null;
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));

describe("useEditor provider swap", () => {
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    providerDocs.length = 0;
    persistedDocs.length = 0;
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it("writes to the new Y.Doc and its IndexedDB binding after the provider changes", async () => {
    await act(async () => root.render(<Harness authToken="a" />));
    await flush();
    const firstEditor = currentEditor;

    await act(async () => root.render(<Harness authToken="b" />));
    await flush();

    expect(providerDocs).toHaveLength(2);
    expect(currentEditor).not.toBe(firstEditor);
    act(() => {
      currentEditor?.commands.insertContent("typed after swap");
    });

    const newDoc = providerDocs[1];
    expect(newDoc.getXmlFragment("default").toString()).toContain("typed after swap");
    expect(providerDocs[0].getXmlFragment("default").toString()).not.toContain("typed after swap");
    expect(persistedDocs[persistedDocs.length - 1]).toBe(newDoc);
  });
});
