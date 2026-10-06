// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

export type SingleLineOptions = {
  onSubmit?: (view: EditorView) => void;
  onCancel?: (view: EditorView) => void;
};

// Newlines become spaces, so pasted multi-line text keeps its length and selection.
export const rejectNewlines: Extension = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || tr.newDoc.lines === 1) return tr;
  const text = tr.newDoc.toString().replace(/\r|\n/g, " ");
  return [tr, { changes: { from: 0, to: tr.newDoc.length, insert: text }, sequential: true }];
});

export function singleLine(options: SingleLineOptions = {}): Extension {
  return [
    rejectNewlines,
    keymap.of([
      {
        key: "Enter",
        run: (view) => {
          options.onSubmit?.(view);
          return true;
        },
      },
      {
        key: "Escape",
        run: (view) => {
          options.onCancel?.(view);
          return true;
        },
      },
    ]),
  ];
}
