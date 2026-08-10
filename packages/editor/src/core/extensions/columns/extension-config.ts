/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { mergeAttributes, Node } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    [CORE_EXTENSIONS.COLUMNS]: {
      insertColumns: (count?: number) => ReturnType;
    };
  }
}

export const ColumnsExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.COLUMNS,
  group: "block",
  content: `${CORE_EXTENSIONS.COLUMN}+`,
  isolating: true,

  addAttributes() {
    return {
      layout: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "columns-component" }];
  },

  // The track sizes come from CSS keyed on the layout attribute rather than an
  // inline style: the server-side HTML generator drops style attributes, and a
  // CSS attribute selector cannot be broken out of by a crafted layout value.
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "editor-columns-component" }), 0];
  },

  addCommands() {
    return {
      insertColumns:
        (count = 2) =>
        ({ tr, dispatch, editor, state }) => {
          // A columns block nested inside another one has nowhere sensible to
          // go, so leave the selection untouched instead of inserting it.
          if (editor.isActive(CORE_EXTENSIONS.COLUMNS)) return false;

          const { schema } = state;
          const columnType = schema.nodes[CORE_EXTENSIONS.COLUMN];
          const paragraphType = schema.nodes[CORE_EXTENSIONS.PARAGRAPH];

          const weights = Array.from({ length: count }, () => "1");
          const columns = weights.map(() => columnType.createChecked(null, paragraphType.create()));
          const node = schema.nodes[CORE_EXTENSIONS.COLUMNS].createChecked({ layout: weights.join("-") }, columns);

          if (dispatch) {
            tr.replaceSelectionWith(node).scrollIntoView();
          }

          return true;
        },
    };
  },
});

export const ColumnExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.COLUMN,
  content: "block+",
  isolating: true,

  parseHTML() {
    return [{ tag: "column-component" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "editor-column-component" }), 0];
  },
});
