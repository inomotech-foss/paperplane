/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PowerKCommandRegistry } from "./registry";
import { ShortcutHandler } from "./shortcut-handler";
import type { TPowerKContext } from "./types";

const noop = () => {};

const context: TPowerKContext = {
  params: {},
  activeCommand: null,
  activeContext: "page",
  shouldShowContextBasedActions: true,
  setShouldShowContextBasedActions: noop,
  router: { push: noop, replace: noop, back: noop, forward: noop, refresh: noop, prefetch: async () => {} },
  closePalette: noop,
  setActiveCommand: noop,
  setActivePage: noop,
};

const setup = () => {
  const lock = vi.fn();
  const create = vi.fn();
  const sidebar = vi.fn();
  const remove = vi.fn();
  const registry = new PowerKCommandRegistry();
  registry.registerMultiple([
    {
      id: "lock",
      i18n_title: "lock",
      group: "contextual",
      contextType: "page",
      type: "action",
      action: lock,
      modifierShortcut: "shift+l",
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
    {
      id: "create",
      i18n_title: "create",
      group: "create",
      type: "action",
      action: create,
      shortcut: "c",
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
    {
      id: "sidebar",
      i18n_title: "sidebar",
      group: "miscellaneous",
      type: "action",
      action: sidebar,
      modifierShortcut: "cmd+b",
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
    {
      id: "remove",
      i18n_title: "remove",
      group: "contextual",
      contextType: "page",
      type: "action",
      action: remove,
      modifierShortcut: "cmd+backspace",
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
  ]);
  const handler = new ShortcutHandler(registry, () => context, noop, noop);
  const press = (target: EventTarget, init: KeyboardEventInit) => {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    handler.handleKeyDown(event);
  };
  return { lock, create, sidebar, remove, press, handler };
};

const shiftL: KeyboardEventInit = { key: "L", code: "KeyL", shiftKey: true };
const plainC: KeyboardEventInit = { key: "c", code: "KeyC" };

const placeCaret = (node: Node, offset: number, focusOffset = offset) => {
  const selection = window.getSelection();
  selection?.removeAllRanges();
  const range = document.createRange();
  range.setStart(node, offset);
  range.setEnd(node, focusOffset);
  selection?.addRange(range);
};

describe("ShortcutHandler", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.getSelection()?.removeAllRanges();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("fires shortcuts from the page background", () => {
    const { lock, create, press } = setup();
    press(document.body, shiftL);
    press(document.body, plainC);
    expect(lock).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("ignores typed characters and delete while the caret sits in a read-only editor", () => {
    document.body.innerHTML = '<div class="ProseMirror" contenteditable="false"><p>Locked text</p></div>';
    const text = document.querySelector("p")?.firstChild;
    if (!text) throw new Error("missing text node");
    placeCaret(text, 3);

    const { lock, create, remove, press } = setup();
    press(document.body, shiftL);
    press(document.body, plainC);
    press(document.body, { key: "Backspace", code: "Backspace", metaKey: true });
    expect(lock).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("keeps modifier shortcuts working with the caret in a read-only editor", () => {
    document.body.innerHTML = '<div class="ProseMirror" contenteditable="false"><p>Locked text</p></div>';
    const text = document.querySelector("p")?.firstChild;
    if (!text) throw new Error("missing text node");
    placeCaret(text, 3);

    const { sidebar, press } = setup();
    press(document.body, { key: "b", code: "KeyB", metaKey: true });
    expect(sidebar).toHaveBeenCalledTimes(1);
  });

  it("fires a plain key with a collapsed caret outside an editor", () => {
    document.body.innerHTML = "<p>Some page text</p>";
    const text = document.querySelector("p")?.firstChild;
    if (!text) throw new Error("missing text node");
    placeCaret(text, 2);

    const { create, remove, press } = setup();
    press(document.body, plainC);
    press(document.body, { key: "Backspace", code: "Backspace", metaKey: true });
    expect(create).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("ignores character keys while text is selected anywhere", () => {
    document.body.innerHTML = "<p>Some page text</p>";
    const text = document.querySelector("p")?.firstChild;
    if (!text) throw new Error("missing text node");
    placeCaret(text, 0, 4);

    const { lock, create, sidebar, press } = setup();
    press(document.body, shiftL);
    press(document.body, plainC);
    press(document.body, { key: "b", code: "KeyB", metaKey: true });
    expect(lock).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(sidebar).toHaveBeenCalledTimes(1);
  });

  it("ignores a stale editor selection once focus moved to a control", () => {
    document.body.innerHTML =
      '<div class="ProseMirror" contenteditable="false"><p>Locked text</p></div><button type="button">Go</button>';
    const text = document.querySelector("p")?.firstChild;
    const button = document.querySelector("button");
    if (!text || !button) throw new Error("missing nodes");
    placeCaret(text, 3);
    button.focus();

    const { lock, press } = setup();
    press(button, shiftL);
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it("ignores keys from a focused element inside a read-only editor", () => {
    document.body.innerHTML = '<div class="editor-container"><div tabindex="0" id="inner">x</div></div>';
    const inner = document.getElementById("inner");
    if (!inner) throw new Error("missing node");
    inner.focus();

    const { lock, press } = setup();
    press(inner, shiftL);
    expect(lock).not.toHaveBeenCalled();
  });
});
