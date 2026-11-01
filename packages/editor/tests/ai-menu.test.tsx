/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Editor, Extension } from "@tiptap/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { AIFeaturesMenu } from "@/components/menus/ai-menu";
import { CustomStarterKitExtension } from "@/extensions/starter-kit";
import type { UtilityExtensionStorage } from "@/extensions/utility";
import type { TAIMenuProps } from "@/types";

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
// jsdom has no layout, and the menu positions itself at the selection.
const emptyRects = () => Object.assign([], { item: () => null });
const emptyRect = () => new DOMRect();
Object.assign(Range.prototype, { getClientRects: emptyRects, getBoundingClientRect: emptyRect });

// The parts of the utility extension the menu uses, without its file and clipboard plugins.
const DropbarExtension = Extension.create<Record<string, never>, UtilityExtensionStorage>({
  name: "utility",
  addStorage: () => ({
    assetsList: [],
    assetsUploadStatus: {},
    uploadInProgress: false,
    activeDropbarExtensions: [],
    isTouchDevice: false,
  }),
  addCommands() {
    return {
      addActiveDropbarExtension: (extension) => () => {
        this.storage.activeDropbarExtensions.push(extension);
      },
      removeActiveDropbarExtension: (extension) => () => {
        this.storage.activeDropbarExtensions = this.storage.activeDropbarExtensions.filter((e) => e !== extension);
      },
    };
  },
});

const setup = async (canReplace = true) => {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: [CustomStarterKitExtension({ enableHistory: false }), DropbarExtension],
    content: "<p>Hello world</p>",
  });
  const onClose = vi.fn();
  const captured: { props?: TAIMenuProps } = {};
  const root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(
      <AIFeaturesMenu
        editor={editor}
        range={{ from: 7, to: 12 }}
        selection="world"
        canReplace={canReplace}
        onClose={onClose}
        menu={(props) => {
          captured.props = props;
          return <button type="button">inside</button>;
        }}
      />
    );
  });
  const teardown = () => {
    act(() => root.unmount());
    editor.destroy();
  };
  return { editor, onClose, captured, teardown };
};

describe("AIFeaturesMenu", () => {
  it("replaces the selection it opened with, even after an edit before it", async () => {
    const { editor, onClose, captured, teardown } = await setup();
    const menuProps = captured.props;
    expect(menuProps?.selection).toBe("world");

    act(() => {
      editor.commands.insertContentAt(1, "Oh, ");
    });
    act(() => menuProps?.onReplace("<p>there</p>"));

    expect(editor.getText()).toBe("Oh, Hello there");
    expect(onClose).toHaveBeenCalledOnce();
    teardown();
  });

  it("registers a dropbar, marks the portal, and closes only itself on Escape", async () => {
    const { editor, onClose, teardown } = await setup();
    expect(editor.storage.utility.activeDropbarExtensions).toContain("ai-menu");
    const portal = document.querySelector("[data-prevent-outside-click]");
    const inside = portal?.querySelector("button");
    if (!inside) throw new Error("the menu did not render");
    const documentListener = vi.fn();
    document.addEventListener("keydown", documentListener);

    act(() => {
      inside.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledOnce();
    // focus can be anywhere once a result or a spinner replaced the focused control
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(documentListener).not.toHaveBeenCalled();
    document.removeEventListener("keydown", documentListener);
    teardown();
    expect(editor.isDestroyed).toBe(true);
  });

  it("does not replace when the selection holds nodes a replace would lose", async () => {
    const { editor, captured, teardown } = await setup(false);
    expect(captured.props?.canReplace).toBe(false);
    act(() => captured.props?.onReplace("<p>there</p>"));
    expect(editor.getText()).toBe("Hello world");
    teardown();
  });
});
