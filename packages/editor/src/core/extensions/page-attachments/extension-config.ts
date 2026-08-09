/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { mergeAttributes, Node } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

/**
 * A live listing of the current page's own attachments. Confluence's macro takes
 * sorting and filtering parameters, none of which the listing offers, so the
 * node carries no attributes.
 */
export const PageAttachmentsExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.PAGE_ATTACHMENTS,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: "page-attachments-component" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["page-attachments-component", mergeAttributes(HTMLAttributes)];
  },
});
