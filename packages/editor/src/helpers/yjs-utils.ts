/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { generateHTML, generateJSON } from "@tiptap/html";
import * as Y from "yjs";
// local imports
import { createDocumentCodecs } from "./document-codecs";

// browser codecs; the server entry (`@plane/editor/server`) builds the same helpers on happy-dom
export const {
  TITLE_EDITOR_EXTENSIONS,
  applyUpdates,
  convertBinaryDataToBase64String,
  convertBase64StringToBinaryData,
  getBinaryDataFromRichTextEditorHTMLString,
  generateTitleProsemirrorJson,
  getBinaryDataFromDocumentEditorHTMLString,
  getAllDocumentFormatsFromRichTextEditorBinaryData,
  getAllDocumentFormatsFromDocumentEditorBinaryData,
  convertHTMLDocumentToAllFormats,
  extractTextFromHTML,
} = createDocumentCodecs({ generateHTML, generateJSON });

/**
 * @description returns true when a document editor Y.Doc has neither content nor title
 * @param {Y.Doc} yDoc
 * @returns {boolean}
 */
// Updates applied from the stored page. They hold no local edits.
export const STORED_PAGE_ORIGIN = "stored-page";

export const isDocumentEditorYDocEmpty = (yDoc: Y.Doc): boolean =>
  yDoc.getXmlFragment("default").length === 0 && yDoc.getXmlFragment("title").length === 0;

/**
 * @description returns true when `update` holds insertions or deletions that `base` does not
 */
export const hasChangesBeyond = (update: Uint8Array, base: Uint8Array): boolean => {
  const baseDoc = new Y.Doc({ gc: false });
  const mergedDoc = new Y.Doc({ gc: false });
  try {
    Y.applyUpdate(baseDoc, base);
    Y.applyUpdate(mergedDoc, base);
    Y.applyUpdate(mergedDoc, update);
    return !Y.equalSnapshots(Y.snapshot(baseDoc), Y.snapshot(mergedDoc));
  } finally {
    baseDoc.destroy();
    mergedDoc.destroy();
  }
};
