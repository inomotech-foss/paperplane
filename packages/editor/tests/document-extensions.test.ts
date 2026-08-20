/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";

import {
  DocumentEditorAdditionalExtensions,
  type TDocumentEditorAdditionalExtensionsProps,
} from "@/plane-editor/extensions";

// Several extensions read fields off their handler as they are constructed, and
// this suite is only about which extensions get registered. One self-returning
// proxy stands in for every handler so a new field never breaks these tests.
const handlerStub = (): never =>
  new Proxy((() => handlerStub()) as object, {
    get: () => handlerStub(),
    apply: () => handlerStub(),
  }) as never;

const props = (
  overrides: Partial<TDocumentEditorAdditionalExtensionsProps> = {}
): TDocumentEditorAdditionalExtensionsProps =>
  ({
    childPagesHandler: handlerStub(),
    diagramHandler: handlerStub(),
    embedHandler: handlerStub(),
    fileHandler: handlerStub(),
    pageAttachmentsHandler: handlerStub(),
    queryBlockHandler: handlerStub(),
    workItemEmbedHandler: handlerStub(),
    disabledExtensions: [],
    flaggedExtensions: [],
    isEditable: false,
    userDetails: { id: "user-1", name: "Test User", color: "#000000" },
    ...overrides,
  }) as TDocumentEditorAdditionalExtensionsProps;

const names = (extensions: ReturnType<typeof DocumentEditorAdditionalExtensions>) =>
  extensions.map((extension) => extension.name);

// A stand-in for HocuspocusProvider: the cursor extension only needs awareness.
const provider = { awareness: { getStates: () => new Map(), on: () => {}, off: () => {} } };

describe("DocumentEditorAdditionalExtensions", () => {
  it("leaves out the collaboration cursor when there is no provider", () => {
    // A page version renders read-only with no Hocuspocus connection; the cursor
    // extension would dereference provider.awareness and throw on editor creation.
    expect(names(DocumentEditorAdditionalExtensions(props()))).not.toContain("collaborationCursor");
  });

  it("adds the collaboration cursor once a provider is connected", () => {
    const extensions = DocumentEditorAdditionalExtensions(props({ provider: provider as never, isEditable: true }));
    expect(names(extensions)).toContain("collaborationCursor");
  });

  it("honours the collaboration-cursor disabled flag even with a provider", () => {
    const extensions = DocumentEditorAdditionalExtensions(
      props({ provider: provider as never, disabledExtensions: ["collaboration-cursor"] })
    );
    expect(names(extensions)).not.toContain("collaborationCursor");
  });

  it("keeps every other extension in place without a provider", () => {
    const withProvider = names(DocumentEditorAdditionalExtensions(props({ provider: provider as never })));
    const without = names(DocumentEditorAdditionalExtensions(props()));
    expect(withProvider.filter((name) => name !== "collaborationCursor")).toEqual(without);
  });
});
