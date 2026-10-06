// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { history, historyKeymap, standardKeymap } from "@codemirror/commands";
import { type ChangeSpec, EditorState, type Extension, Prec } from "@codemirror/state";
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

// Not `defaultKeymap`: its line commands (copy line, blank line) would add text through `rejectNewlines`.
export const singleLineKeymap: Extension = keymap.of([...standardKeymap, ...historyKeymap]);

// Enter and Escape sit above the editing keys; an open completion list sits above both (`Prec.highest`).
export function singleLine(options: SingleLineOptions = {}): Extension {
  return [
    rejectNewlines,
    history(),
    singleLineKeymap,
    Prec.high(
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
      ])
    ),
  ];
}
