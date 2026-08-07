/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { mergeAttributes, Node } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

/**
 * An invisible in-page jump target, as produced by Confluence's anchor macro.
 *
 * Rendering the name as a DOM `id` is what makes it work: a link to `#name`
 * is then resolved by the browser itself, with no scroll handling of our own.
 */
export const AnchorExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.ANCHOR,
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute("name") ?? element.getAttribute("id"),
      },
    };
  },

  parseHTML() {
    return [{ tag: "anchor-component" }];
  },

  renderHTML({ HTMLAttributes }) {
    const name = (HTMLAttributes.name as string) ?? "";
    return ["anchor-component", mergeAttributes(HTMLAttributes, { id: name, "data-anchor": name })];
  },
});
