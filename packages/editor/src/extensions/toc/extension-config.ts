/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { mergeAttributes, Node } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

export const DEFAULT_TOC_MIN_LEVEL = 1;
export const DEFAULT_TOC_MAX_LEVEL = 6;

/**
 * A table of contents built from the document's own headings at render time,
 * so it never goes stale. Attribute names match Confluence's toc macro
 * parameters, which is what the importer emits.
 */
export const TableOfContentsExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.TABLE_OF_CONTENTS,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      "min-level": {
        default: DEFAULT_TOC_MIN_LEVEL,
        parseHTML: (element) => Number(element.getAttribute("min-level")) || DEFAULT_TOC_MIN_LEVEL,
      },
      "max-level": {
        default: DEFAULT_TOC_MAX_LEVEL,
        parseHTML: (element) => Number(element.getAttribute("max-level")) || DEFAULT_TOC_MAX_LEVEL,
      },
    };
  },

  parseHTML() {
    return [{ tag: "toc-component" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["toc-component", mergeAttributes(HTMLAttributes)];
  },
});
