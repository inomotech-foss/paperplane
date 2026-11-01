/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { getHTMLFromFragment } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import type { Mapping } from "@tiptap/pm/transform";
// plane imports
import { convertHTMLToMarkdown } from "@plane/utils";
// types
import type { IEditorProps } from "@/types";

const parseHTML = (html: string): HTMLElement => {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element;
};

const clampRange = (editor: Editor, range: Range): Range => {
  const size = editor.state.doc.content.size;
  const from = Math.max(0, Math.min(range.from, size));
  return { from, to: Math.max(from, Math.min(range.to, size)) };
};

/** The selected content as Markdown. */
export const getSelectionMarkdown = (editor: Editor, getEditorMetaData: IEditorProps["getEditorMetaData"]): string => {
  const html = getHTMLFromFragment(editor.state.selection.content().content, editor.schema);
  return convertHTMLToMarkdown({ description_html: html, metaData: getEditorMetaData(html) }).trim();
};

/** Follows a range through later changes, including remote ones, so it still covers the same content. */
export const mapRange = (range: Range, mapping: Mapping): Range => {
  const from = mapping.map(range.from, 1);
  return { from, to: Math.max(from, mapping.map(range.to, -1)) };
};

/** Replaces the range with the HTML. A single paragraph goes inline, like a paste. */
export const replaceRangeWithHTML = (editor: Editor, range: Range, html: string): void => {
  const { from, to } = clampRange(editor, range);
  const slice = ProseMirrorDOMParser.fromSchema(editor.schema).parseSlice(parseHTML(html));
  editor.view.dispatch(editor.state.tr.replaceRange(from, to, slice).scrollIntoView());
  editor.commands.focus();
};

/** Inserts the HTML as new blocks after the top-level block that contains the end of the range. */
export const insertHTMLBelowRange = (editor: Editor, range: Range, html: string): void => {
  const { to } = clampRange(editor, range);
  const $to = editor.state.doc.resolve(to);
  const position = $to.depth > 0 ? $to.after(1) : to;
  const content = ProseMirrorDOMParser.fromSchema(editor.schema).parse(parseHTML(html)).content;
  editor.view.dispatch(editor.state.tr.insert(position, content).scrollIntoView());
  editor.commands.focus();
};
