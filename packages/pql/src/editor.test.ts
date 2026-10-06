// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

// @vitest-environment jsdom

import { autocompletion, completionStatus, currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pqlCompletionSource } from "./completion.js";
import { vocabulary } from "./test-vocabulary.js";

let view: EditorView | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
});

async function completionsFor(doc: string): Promise<string[]> {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: { anchor: doc.length },
      extensions: [autocompletion({ override: [pqlCompletionSource(vocabulary)], activateOnTyping: false })],
    }),
  });
  startCompletion(view);
  const editor = view;
  await vi.waitFor(() => expect(completionStatus(editor.state)).toBe("active"));
  return currentCompletions(view.state).map((completion) => completion.label);
}

describe("pqlCompletionSource through CodeMirror's filter", () => {
  it("keeps entity names that match the typed prefix inside an open quote", async () => {
    expect(await completionsFor('state = "In')).toEqual(["In Progress"]);
  });

  it('keeps custom property names typed after cf["', async () => {
    expect(await completionsFor('cf["Sev')).toEqual(["Severity"]);
  });

  it("filters field names by prefix", async () => {
    expect(await completionsFor("pri")).toEqual(["priority"]);
  });
});
