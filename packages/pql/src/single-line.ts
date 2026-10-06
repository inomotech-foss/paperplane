// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { type ChangeSpec, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

export type SingleLineOptions = {
  onSubmit?: (view: EditorView) => void;
  onCancel?: (view: EditorView) => void;
};

// Each inserted newline becomes a space, so lengths and the selection stay as they were.
export const rejectNewlines: Extension = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || tr.newDoc.lines === 1) return tr;
  const changes: ChangeSpec[] = [];
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    changes.push({ from: fromA, to: toA, insert: inserted.toString().replace(/\n/g, " ") });
  });
  return { changes, selection: tr.selection, effects: tr.effects, scrollIntoView: tr.scrollIntoView };
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
