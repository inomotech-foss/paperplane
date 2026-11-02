/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  getAllDocumentFormatsFromDocumentEditorBinaryData,
  getBinaryDataFromDocumentEditorHTMLString,
  hasChangesBeyond,
  isDocumentEditorYDocEmpty,
} from "@/helpers/yjs-utils";

describe("isDocumentEditorYDocEmpty", () => {
  it("is true for a new doc", () => {
    expect(isDocumentEditorYDocEmpty(new Y.Doc())).toBe(true);
  });

  it("is false once content is seeded", () => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, getBinaryDataFromDocumentEditorHTMLString("<p>hello</p>"));
    expect(isDocumentEditorYDocEmpty(doc)).toBe(false);
  });

  it("is false when only the title is set", () => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, getBinaryDataFromDocumentEditorHTMLString("<p></p>", "Title"));
    doc.getXmlFragment("default").delete(0, doc.getXmlFragment("default").length);
    expect(isDocumentEditorYDocEmpty(doc)).toBe(false);
  });
});

describe("mention author", () => {
  it("survives the round trip through the binary document", () => {
    const html =
      '<p><mention-component id="m1" entity_identifier="u1" entity_name="user_mention" author="u2"></mention-component></p>';
    const { contentHTML } = getAllDocumentFormatsFromDocumentEditorBinaryData(
      getBinaryDataFromDocumentEditorHTMLString(html),
      false
    );
    expect(contentHTML).toContain('author="u2"');
  });
});

const roundTrip = (html: string) =>
  getAllDocumentFormatsFromDocumentEditorBinaryData(getBinaryDataFromDocumentEditorHTMLString(html), false).contentHTML;

describe("span marks", () => {
  it("keeps a comment mark", () => {
    const html = roundTrip('<p><span class="editor-comment-mark" data-comment-thread-id="t1">noted</span></p>');
    expect(html).toContain('data-comment-thread-id="t1"');
  });

  it("keeps a text colour", () => {
    expect(roundTrip('<p><span data-text-color="red">red</span></p>')).toContain('data-text-color="red"');
  });
});

describe("hasChangesBeyond", () => {
  const server = new Y.Doc();
  server.getText("t").insert(0, "saved");
  const saved = Y.encodeStateAsUpdate(server);
  const localFrom = (edit: (text: Y.Text) => void) => {
    const local = new Y.Doc();
    Y.applyUpdate(local, saved);
    edit(local.getText("t"));
    return Y.encodeStateAsUpdate(local);
  };

  it("is false when the server already has everything", () => {
    expect(
      hasChangesBeyond(
        localFrom(() => {}),
        saved
      )
    ).toBe(false);
  });

  it("is true for an insertion", () => {
    expect(
      hasChangesBeyond(
        localFrom((text) => text.insert(5, "!")),
        saved
      )
    ).toBe(true);
  });

  it("is true for a deletion alone", () => {
    expect(
      hasChangesBeyond(
        localFrom((text) => text.delete(0, 1)),
        saved
      )
    ).toBe(true);
  });
});
