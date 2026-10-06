// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

// @vitest-environment jsdom

import { autocompletion, completionStatus, currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView, runScopeHandlers } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pqlCompletionSource } from "./completion.js";
import { pql } from "./index.js";
import type { SingleLineOptions } from "./single-line.js";
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

  it("ranks a lookup path such as assignees__id below the plain names", async () => {
    expect(await completionsFor("assig")).toEqual(["assignee", "assignees", "assignees__id"]);
  });
});

function editorFor(doc: string, options: SingleLineOptions = {}): EditorView {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: { anchor: doc.length },
      extensions: pql({ vocabulary, ...options }),
    }),
  });
  return view;
}

// Runs a key through the editor's keymaps the way a real keydown would.
function press(editor: EditorView, key: string, modifiers: KeyboardEventInit = {}): boolean {
  return runScopeHandlers(editor, new KeyboardEvent("keydown", { key, ...modifiers }), "editor");
}

describe("pql() editing keys on a single line", () => {
  const query = 'state = "Done" AND priority = h';

  it("deletes one character backward and forward", () => {
    const editor = editorFor(query);
    expect(press(editor, "Backspace")).toBe(true);
    expect(editor.state.doc.toString()).toBe('state = "Done" AND priority = ');
    editor.dispatch({ selection: { anchor: 0 } });
    expect(press(editor, "Delete")).toBe(true);
    expect(editor.state.doc.toString()).toBe('tate = "Done" AND priority = ');
  });

  it("deletes the word before the caret and nothing else", () => {
    const editor = editorFor(query);
    expect(press(editor, "Backspace", { ctrlKey: true })).toBe(true);
    expect(editor.state.doc.toString()).toBe('state = "Done" AND priority = ');
  });

  it("undoes and redoes an edit", () => {
    const editor = editorFor(query);
    press(editor, "Backspace", { ctrlKey: true });
    expect(press(editor, "z", { ctrlKey: true })).toBe(true);
    expect(editor.state.doc.toString()).toBe(query);
    expect(press(editor, "y", { ctrlKey: true })).toBe(true);
    expect(editor.state.doc.toString()).toBe('state = "Done" AND priority = ');
  });

  it("submits on Enter without inserting a newline", () => {
    const onSubmit = vi.fn();
    const editor = editorFor(query, { onSubmit });
    expect(press(editor, "Enter")).toBe(true);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(editor.state.doc.toString()).toBe(query);
  });

  it("closes an open completion on Escape before it cancels", async () => {
    const onCancel = vi.fn();
    const editor = editorFor("pri", { onCancel });
    startCompletion(editor);
    await vi.waitFor(() => expect(completionStatus(editor.state)).toBe("active"));
    expect(press(editor, "Escape")).toBe(true);
    expect(completionStatus(editor.state)).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
    expect(press(editor, "Escape")).toBe(true);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("accepts an open completion on Enter instead of submitting", async () => {
    const onSubmit = vi.fn();
    const editor = editorFor("pri", { onSubmit });
    startCompletion(editor);
    await vi.waitFor(() => expect(completionStatus(editor.state)).toBe("active"));
    // CodeMirror ignores an accept within `interactionDelay` (75 ms) of the list opening.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(press(editor, "Enter")).toBe(true);
    expect(editor.state.doc.toString()).toBe("priority");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
