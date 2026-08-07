/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { mergeAttributes, Node } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

export const DEFAULT_CHILD_PAGES_DEPTH = 1;
export const MAX_CHILD_PAGES_DEPTH = 20;

/**
 * A live listing of the current page's descendants. `depth` matches Confluence's
 * children macro parameter, which is what the importer emits.
 */
export const ChildPagesExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.CHILD_PAGES,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      depth: {
        default: DEFAULT_CHILD_PAGES_DEPTH,
        parseHTML: (element) => {
          const depth = Number(element.getAttribute("depth")) || DEFAULT_CHILD_PAGES_DEPTH;
          return Math.min(Math.max(depth, 1), MAX_CHILD_PAGES_DEPTH);
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "child-pages-component" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["child-pages-component", mergeAttributes(HTMLAttributes)];
  },
});
