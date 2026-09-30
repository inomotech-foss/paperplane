/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { mergeAttributes, Node } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    [CORE_EXTENSIONS.MATH_INLINE]: {
      insertMathInline: (latex?: string) => ReturnType;
    };
    [CORE_EXTENSIONS.MATH_BLOCK]: {
      insertMathBlock: (latex?: string) => ReturnType;
    };
  }
}

/**
 * A LaTeX equation rendered inline with the surrounding text. Confluence's
 * math macros reduce to a single LaTeX string, which is what the importer
 * emits and all KaTeX needs to render it.
 */
export const MathInlineExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.MATH_INLINE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      // Without an explicit parseHTML, Tiptap's default attribute parsing
      // coerces a purely-numeric LaTeX body (e.g. "42") into a JS number.
      latex: { default: null, parseHTML: (element) => element.getAttribute("latex") },
    };
  },

  parseHTML() {
    return [{ tag: "math-inline-component" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["math-inline-component", mergeAttributes(HTMLAttributes)];
  },

  addCommands() {
    return {
      insertMathInline:
        (latex = "") =>
        ({ chain }) =>
          chain().insertContent({ type: CORE_EXTENSIONS.MATH_INLINE, attrs: { latex } }).run(),
    };
  },
});

/**
 * A LaTeX equation rendered as its own block, e.g. Confluence's block math
 * macro.
 */
export const MathBlockExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.MATH_BLOCK,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      latex: { default: null, parseHTML: (element) => element.getAttribute("latex") },
    };
  },

  parseHTML() {
    return [{ tag: "math-block-component" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["math-block-component", mergeAttributes(HTMLAttributes)];
  },

  addCommands() {
    return {
      insertMathBlock:
        (latex = "") =>
        ({ chain }) =>
          chain().insertContent({ type: CORE_EXTENSIONS.MATH_BLOCK, attrs: { latex } }).run(),
    };
  },
});
