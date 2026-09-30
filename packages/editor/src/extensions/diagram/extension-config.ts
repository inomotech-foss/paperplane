/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { mergeAttributes, Node } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

/**
 * A draw.io diagram. `asset_id` holds the editable `.drawio` XML as a page
 * attachment; `preview_asset_id` holds the rendered image the node displays.
 * `width` and `height` are the diagram's natural pixel size, used to reserve
 * the right aspect ratio while the preview loads.
 */
export const DiagramExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.DIAGRAM,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      asset_id: { default: null },
      preview_asset_id: { default: null },
      width: { default: null },
      height: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "diagram-component" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["diagram-component", mergeAttributes(HTMLAttributes)];
  },
});
