/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { mergeAttributes, Node } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

/**
 * A third-party page framed inline. Confluence's macros for Miro, iframe and
 * widget embeds all reduce to a URL and an optional size, which is what the
 * importer emits.
 */
export const EmbedExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.EMBED,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: null },
      // Without an explicit parseHTML, Tiptap's default attribute parsing
      // coerces a purely-numeric string (height="400", the importer's shape)
      // into a JS number, which breaks callers typed to expect a string.
      width: { default: null, parseHTML: (element) => element.getAttribute("width") },
      height: { default: null, parseHTML: (element) => element.getAttribute("height") },
    };
  },

  parseHTML() {
    return [{ tag: "embed-component" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["embed-component", mergeAttributes(HTMLAttributes)];
  },
});
