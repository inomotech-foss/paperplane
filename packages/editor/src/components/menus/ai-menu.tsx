/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { posToDOMRect } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import { useEffect, useState } from "react";
// helpers
import { createRangeTracker, insertHTMLBelowRange, replaceRangeWithHTML } from "@/helpers/ai";
// types
import type { TAIHandler } from "@/types";

type Props = {
  editor: Editor;
  menu: NonNullable<TAIHandler["menu"]>;
  /** The selection the menu works on, taken when it opened. */
  range: Range;
  /** The same selection as Markdown. */
  selection: string;
  canReplace: boolean;
  onClose: () => void;
};

export function AIFeaturesMenu(props: Props) {
  const { editor, menu, range, selection, canReplace, onClose } = props;
  // keeps the range on the same content, so the result lands where the selection is now
  const [tracker] = useState(() => createRangeTracker(editor, range));
  // inside a modal dialog, so its focus trap and outside-press handling treat the menu as its own
  const [portalRoot] = useState(() => {
    const dialog = editor.view.dom.closest("[role='dialog']");
    return dialog instanceof HTMLElement ? dialog : null;
  });
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { getFloatingProps } = useInteractions([useDismiss(context, { escapeKey: false })]);

  useEffect(() => tracker.start(), [tracker]);

  // An open dropbar tells the surrounding peek or modal to leave outside presses and Escape alone.
  useEffect(() => {
    editor.commands.addActiveDropbarExtension("ai-menu");
    return () => {
      if (!editor.isDestroyed) editor.commands.removeActiveDropbarExtension("ai-menu");
    };
  }, [editor]);

  useEffect(() => {
    refs.setPositionReference({
      getBoundingClientRect: () => {
        const current = editor.isDestroyed ? null : tracker.resolve();
        return current ? posToDOMRect(editor.view, current.from, current.to) : new DOMRect();
      },
    });
  }, [editor, refs, tracker]);

  const apply = (write: (target: Range) => boolean) => {
    const current = tracker.resolve();
    if (current) write(current);
    onClose();
  };

  return (
    <FloatingPortal root={portalRoot ?? undefined}>
      <div
        ref={(node) => refs.setFloating(node)}
        data-prevent-outside-click
        style={{ ...floatingStyles, zIndex: 100 }}
        {...getFloatingProps({
          onKeyDown: (event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
          },
        })}
      >
        {menu({
          selection,
          canReplace,
          onReplace: (html) => apply((target) => canReplace && replaceRangeWithHTML(editor, target, html)),
          onInsertBelow: (html) => apply((target) => insertHTMLBelowRange(editor, target, html)),
          onClose,
        })}
      </div>
    </FloatingPortal>
  );
}
