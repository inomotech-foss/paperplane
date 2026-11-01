/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { getHTMLFromFragment } from "@tiptap/core";
import type { Editor, EditorEvents, Range } from "@tiptap/core";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import type { Slice } from "@tiptap/pm/model";
import type { Mapping } from "@tiptap/pm/transform";
import {
  absolutePositionToRelativePosition,
  ProsemirrorBinding,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from "@tiptap/y-tiptap";
import * as Y from "yjs";
// plane imports
import { convertHTMLToMarkdown } from "@plane/utils";
import { readField } from "@plane/types";
// types
import type { IEditorProps } from "@/types";

// Atoms that survive the Markdown round trip. Any other atom (mention, image, embed) would be lost on replace.
const MARKDOWN_SAFE_ATOMS = new Set(["hardBreak", "horizontalRule"]);

// An inert document: nothing in it loads or runs while it is parsed.
const parseHTML = (html: string): HTMLElement => new DOMParser().parseFromString(html, "text/html").body;

const isWritable = (editor: Editor) => editor.isEditable && !editor.isDestroyed;

/** The selected content as Markdown. */
export const getSelectionMarkdown = (editor: Editor, getEditorMetaData: IEditorProps["getEditorMetaData"]): string => {
  const html = getHTMLFromFragment(editor.state.selection.content().content, editor.schema);
  return convertHTMLToMarkdown({ description_html: html, metaData: getEditorMetaData(html) }).trim();
};

/** Whether the content has nodes, such as mentions, images or embeds, that a Markdown result cannot bring back. */
export const hasNodesLostByMarkdown = (slice: Slice): boolean => {
  let found = false;
  slice.content.descendants((node) => {
    if (found) return false;
    if (node.isAtom && !node.isText && !MARKDOWN_SAFE_ATOMS.has(node.type.name)) found = true;
    return !found;
  });
  return found;
};

/** Follows a range through a change. Returns null once the range's content is gone. */
export const mapRange = (range: Range, mapping: Mapping): Range | null => {
  const from = mapping.mapResult(range.from, 1);
  const to = mapping.mapResult(range.to, -1);
  if (to.pos <= from.pos) return null;
  return { from: from.pos, to: to.pos };
};

const getYSyncBinding = (editor: Editor): ProsemirrorBinding | undefined => {
  const binding = readField(ySyncPluginKey.getState(editor.state), "binding");
  return binding instanceof ProsemirrorBinding ? binding : undefined;
};

export type TRangeTracker = {
  /** Starts following local changes. Returns the cleanup. */
  start: () => () => void;
  /** The range now, or null when its content was deleted. */
  resolve: () => Range | null;
};

/**
 * Keeps a range on the same content while the document changes.
 * Collaborative documents use Yjs relative positions, because a remote update reaches ProseMirror
 * as one replace of the whole document, which no step mapping can follow.
 */
export const createRangeTracker = (editor: Editor, range: Range): TRangeTracker => {
  const binding = getYSyncBinding(editor);
  if (binding) {
    const toRelative = (pos: number, assoc: number): Y.RelativePosition | null => {
      const relative: unknown = absolutePositionToRelativePosition(pos, binding.type, binding.mapping);
      if (!(relative instanceof Y.RelativePosition)) return null;
      // y-tiptap anchors to the left (assoc -1). The start anchors to the right instead, so text inserted
      // exactly at the start stays outside the range, like the step mapping does.
      const absolute = Y.createAbsolutePositionFromRelativePosition(relative, binding.doc);
      return absolute ? Y.createRelativePositionFromTypeIndex(absolute.type, absolute.index, assoc) : null;
    };
    const relativeFrom = toRelative(range.from, 0);
    const relativeTo = toRelative(range.to, -1);
    return {
      start: () => () => {},
      resolve: () => {
        const current = getYSyncBinding(editor);
        if (!current || !relativeFrom || !relativeTo) return null;
        const from = relativePositionToAbsolutePosition(current.doc, current.type, relativeFrom, current.mapping);
        const to = relativePositionToAbsolutePosition(current.doc, current.type, relativeTo, current.mapping);
        return from === null || to === null || to <= from ? null : { from, to };
      },
    };
  }

  let current: Range | null = range;
  return {
    start: () => {
      const handleTransaction = ({ transaction }: EditorEvents["transaction"]) => {
        if (current && transaction.docChanged) current = mapRange(current, transaction.mapping);
      };
      editor.on("transaction", handleTransaction);
      return () => {
        editor.off("transaction", handleTransaction);
      };
    },
    resolve: () => current,
  };
};

/** Replaces the range with the HTML. A single paragraph goes inline, like a paste. */
export const replaceRangeWithHTML = (editor: Editor, range: Range, html: string): boolean => {
  if (!isWritable(editor)) return false;
  const slice = ProseMirrorDOMParser.fromSchema(editor.schema).parseSlice(parseHTML(html));
  editor.view.dispatch(editor.state.tr.replaceRange(range.from, range.to, slice).scrollIntoView());
  editor.commands.focus();
  return true;
};

/** Inserts the HTML as new blocks after the top-level block that contains the end of the range. */
export const insertHTMLBelowRange = (editor: Editor, range: Range, html: string): boolean => {
  if (!isWritable(editor)) return false;
  const $to = editor.state.doc.resolve(Math.min(range.to, editor.state.doc.content.size));
  const position = $to.depth > 0 ? $to.after(1) : $to.pos;
  const content = ProseMirrorDOMParser.fromSchema(editor.schema).parse(parseHTML(html)).content;
  editor.view.dispatch(editor.state.tr.insert(position, content).scrollIntoView());
  editor.commands.focus();
  return true;
};
