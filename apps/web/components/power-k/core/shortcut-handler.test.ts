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
  const picker = vi.fn();
  const create = vi.fn();
  const sidebar = vi.fn();
  const remove = vi.fn();
  const goModules = vi.fn();
  const chordL = vi.fn();
  const labels = vi.fn();
  const shiftA = vi.fn();
  const togglePalette = vi.fn();
  const registry = new PowerKCommandRegistry();
  registry.registerMultiple([
    {
      id: "picker",
      i18n_title: "picker",
      group: "contextual",
      contextType: "page",
      type: "action",
      changesState: false,
      action: picker,
      shortcut: "shift+l",
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
    {
      id: "labels",
      i18n_title: "labels",
      group: "contextual",
      contextType: "page",
      type: "action",
      changesState: false,
      action: labels,
      shortcut: "l",
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
    {
      id: "shift-a",
      i18n_title: "shift-a",
      group: "contextual",
      contextType: "page",
      type: "action",
      changesState: false,
      action: shiftA,
      shortcut: "shift+a",
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
    {
      id: "chord-l",
      i18n_title: "chord-l",
      group: "miscellaneous",
      type: "action",
      changesState: true,
      action: chordL,
      modifierShortcut: "cmd+shift+l",
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
    {
      id: "go-modules",
      i18n_title: "go-modules",
      group: "navigation",
      type: "action",
      changesState: false,
      action: goModules,
      keySequence: "gm",
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
    {
      id: "create",
      i18n_title: "create",
      group: "create",
      type: "action",
      changesState: false,
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
      changesState: true,
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
      changesState: true,
      action: remove,
      modifierShortcut: "cmd+backspace",
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
  ]);
  const handler = new ShortcutHandler(registry, () => context, noop, togglePalette);
  const press = (target: EventTarget, init: KeyboardEventInit) => {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    handler.handleKeyDown(event);
  };
  return { picker, create, sidebar, remove, goModules, chordL, labels, shiftA, togglePalette, press, handler };
};

const shiftL: KeyboardEventInit = { key: "L", code: "KeyL", shiftKey: true };
const plainC: KeyboardEventInit = { key: "c", code: "KeyC" };
const plainL: KeyboardEventInit = { key: "l", code: "KeyL" };
const plainG: KeyboardEventInit = { key: "g", code: "KeyG" };
const plainM: KeyboardEventInit = { key: "m", code: "KeyM" };

const stubLayoutMap = (entries: [string, string][]) => {
  Object.defineProperty(navigator, "keyboard", {
    value: { getLayoutMap: async () => new Map(entries) },
    configurable: true,
  });
};

const flushLayoutMap = () => new Promise((resolve) => setTimeout(resolve, 0));

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
    Reflect.deleteProperty(navigator, "keyboard");
    document.body.innerHTML = "";
  });

  it("fires shortcuts from the page background", () => {
    const { picker, create, press } = setup();
    press(document.body, shiftL);
    press(document.body, plainC);
    expect(picker).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("ignores typed characters and delete while the caret sits in a read-only editor", () => {
    document.body.innerHTML = '<div class="ProseMirror" contenteditable="false"><p>Locked text</p></div>';
    const text = document.querySelector("p")?.firstChild;
    if (!text) throw new Error("missing text node");
    placeCaret(text, 3);

    const { picker, create, remove, press } = setup();
    press(document.body, shiftL);
    press(document.body, plainC);
    press(document.body, { key: "Backspace", code: "Backspace", metaKey: true });
    expect(picker).not.toHaveBeenCalled();
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

  it("ignores bare and Shift+letter keys while text is selected outside an editor", () => {
    document.body.innerHTML = "<p>Some page text</p>";
    const text = document.querySelector("p")?.firstChild;
    if (!text) throw new Error("missing text node");
    placeCaret(text, 0, 4);

    const { picker, create, sidebar, press } = setup();
    press(document.body, shiftL);
    press(document.body, plainC);
    press(document.body, { key: "b", code: "KeyB", metaKey: true });
    expect(picker).not.toHaveBeenCalled();
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

    const { picker, press } = setup();
    press(button, shiftL);
    expect(picker).toHaveBeenCalledTimes(1);
  });

  it("ignores keys from a focused element inside a read-only editor", () => {
    document.body.innerHTML = '<div class="editor-container"><div tabindex="0" id="inner">x</div></div>';
    const inner = document.getElementById("inner");
    if (!inner) throw new Error("missing node");
    inner.focus();

    const { picker, press } = setup();
    press(inner, shiftL);
    expect(picker).not.toHaveBeenCalled();
  });

  it("matches Shift+letter as a typed key, apart from bare keys and chords", () => {
    const { picker, chordL, press } = setup();
    press(document.body, plainL);
    expect(picker).not.toHaveBeenCalled();

    press(document.body, shiftL);
    expect(picker).toHaveBeenCalledTimes(1);
    expect(chordL).not.toHaveBeenCalled();

    press(document.body, { ...shiftL, metaKey: true });
    expect(chordL).toHaveBeenCalledTimes(1);
    expect(picker).toHaveBeenCalledTimes(1);
  });

  it("ignores Shift+letter typed into an input", () => {
    document.body.innerHTML = "<input />";
    const input = document.querySelector("input");
    if (!input) throw new Error("missing input");
    input.focus();

    const { picker, press } = setup();
    press(input, shiftL);
    expect(picker).not.toHaveBeenCalled();
  });

  it("ends a pending sequence on Shift+letter", () => {
    const { picker, goModules, press } = setup();
    press(document.body, plainG);
    press(document.body, shiftL);
    press(document.body, plainM);
    expect(picker).toHaveBeenCalledTimes(1);
    expect(goModules).not.toHaveBeenCalled();

    press(document.body, plainG);
    press(document.body, plainM);
    expect(goModules).toHaveBeenCalledTimes(1);
  });

  it("reads a Caps Lock letter as the bare key, never as Shift+letter", () => {
    const { picker, labels, press } = setup();
    press(document.body, { key: "L", code: "KeyL", shiftKey: false });
    expect(labels).toHaveBeenCalledTimes(1);
    expect(picker).not.toHaveBeenCalled();
  });

  it("matches Shift+letter by the layout's character on a non-US layout", async () => {
    stubLayoutMap([
      ["KeyQ", "a"],
      ["KeyA", "q"],
    ]);
    const { shiftA, press } = setup();
    await flushLayoutMap();

    press(document.body, { key: "A", code: "KeyQ", shiftKey: true });
    expect(shiftA).toHaveBeenCalledTimes(1);

    press(document.body, { key: "Q", code: "KeyA", shiftKey: true });
    expect(shiftA).toHaveBeenCalledTimes(1);
  });

  it("ignores AltGr for typed keys, chords and the palette toggle", () => {
    const { labels, picker, togglePalette, press } = setup();
    press(document.body, { key: "l", code: "KeyL", modifierAltGraph: true });
    press(document.body, { key: "L", code: "KeyL", shiftKey: true, modifierAltGraph: true });
    press(document.body, { key: "k", code: "KeyK", ctrlKey: true, altKey: true });
    press(document.body, { key: "k", code: "KeyK", ctrlKey: true, modifierAltGraph: true });
    expect(labels).not.toHaveBeenCalled();
    expect(picker).not.toHaveBeenCalled();
    expect(togglePalette).not.toHaveBeenCalled();

    press(document.body, { key: "k", code: "KeyK", metaKey: true });
    expect(togglePalette).toHaveBeenCalledTimes(1);
  });
});
