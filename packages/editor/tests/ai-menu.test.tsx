/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Editor } from "@tiptap/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { AIFeaturesMenu } from "@/components/menus/ai-menu";
import { CustomStarterKitExtension } from "@/extensions/starter-kit";
import type { TAIMenuProps } from "@/types";

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
// jsdom has no layout, and the menu positions itself at the selection.
const emptyRects = () => Object.assign([], { item: () => null });
const emptyRect = () => new DOMRect();
Object.assign(Range.prototype, { getClientRects: emptyRects, getBoundingClientRect: emptyRect });

describe("AIFeaturesMenu", () => {
  it("replaces the selection it opened with, even after an edit before it", async () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: [CustomStarterKitExtension({ enableHistory: false })],
      content: "<p>Hello world</p>",
    });
    const onClose = vi.fn();
    let menuProps: TAIMenuProps | undefined;
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AIFeaturesMenu
          editor={editor}
          range={{ from: 7, to: 12 }}
          selection="world"
          onClose={onClose}
          menu={(props) => {
            menuProps = props;
            return null;
          }}
        />
      );
    });
    expect(menuProps?.selection).toBe("world");

    act(() => {
      editor.commands.insertContentAt(1, "Oh, ");
    });
    act(() => menuProps?.onReplace("<p>there</p>"));

    expect(editor.getText()).toBe("Oh, Hello there");
    expect(onClose).toHaveBeenCalledOnce();
    act(() => root.unmount());
    editor.destroy();
  });
});
