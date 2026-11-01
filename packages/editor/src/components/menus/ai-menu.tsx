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
import type { Editor, EditorEvents, Range } from "@tiptap/core";
import { useEffect, useState } from "react";
// helpers
import { insertHTMLBelowRange, mapRange, replaceRangeWithHTML } from "@/helpers/ai";
// types
import type { TAIHandler } from "@/types";

type Props = {
  editor: Editor;
  menu: NonNullable<TAIHandler["menu"]>;
  /** The selection the menu works on, taken when it opened. */
  range: Range;
  /** The same selection as Markdown. */
  selection: string;
  onClose: () => void;
};

export function AIFeaturesMenu(props: Props) {
  const { editor, menu, range, selection, onClose } = props;
  // kept in step with later edits, so the result lands where the selection is now
  const [currentRange, setCurrentRange] = useState(range);
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
  const { getFloatingProps } = useInteractions([useDismiss(context)]);

  useEffect(() => {
    refs.setPositionReference({
      getBoundingClientRect: () => {
        if (editor.isDestroyed) return new DOMRect();
        const size = editor.state.doc.content.size;
        const from = Math.min(currentRange.from, size);
        return posToDOMRect(editor.view, from, Math.max(from, Math.min(currentRange.to, size)));
      },
    });
  }, [editor, refs, currentRange]);

  useEffect(() => {
    const handleTransaction = ({ transaction }: EditorEvents["transaction"]) => {
      if (transaction.docChanged) setCurrentRange((previous) => mapRange(previous, transaction.mapping));
    };
    editor.on("transaction", handleTransaction);
    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [editor]);

  return (
    <FloatingPortal>
      <div ref={(node) => refs.setFloating(node)} style={{ ...floatingStyles, zIndex: 100 }} {...getFloatingProps()}>
        {menu({
          selection,
          onReplace: (html) => {
            replaceRangeWithHTML(editor, currentRange, html);
            onClose();
          },
          onInsertBelow: (html) => {
            insertHTMLBelowRange(editor, currentRange, html);
            onClose();
          },
          onClose,
        })}
      </div>
    </FloatingPortal>
  );
}
