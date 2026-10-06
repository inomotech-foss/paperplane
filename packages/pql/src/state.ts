// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { type EditorState, StateField } from "@codemirror/state";

import { type ParseResult, parseQuery } from "./parse.js";

// One parse per document change, shared by highlighting and linting.
export const parseField = StateField.define<ParseResult>({
  create: (state) => parseQuery(state.doc.toString()),
  update: (value, tr) => (tr.docChanged ? parseQuery(tr.newDoc.toString()) : value),
});

export function parsed(state: EditorState): ParseResult {
  return state.field(parseField, false) ?? parseQuery(state.doc.toString());
}
