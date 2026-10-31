/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Extension } from "@tiptap/core";
import type { NodeType, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

function nodeEqualsType({ types, node }: { types: NodeType[]; node: ProseMirrorNode | null }) {
  return node !== null && types.includes(node.type);
}

export interface TrailingNodeOptions {
  node: string;
  notAfter: string[];
}

export const TrailingNode = Extension.create<TrailingNodeOptions>({
  name: "trailingNode",

  addOptions() {
    return {
      node: CORE_EXTENSIONS.PARAGRAPH,
      notAfter: [CORE_EXTENSIONS.PARAGRAPH],
    };
  },

  addProseMirrorPlugins() {
    const plugin = new PluginKey<boolean>(this.name);
    const disabledNodes = Object.entries(this.editor.schema.nodes)
      .map(([, value]) => value)
      .filter((node) => this.options.notAfter.includes(node.name));

    return [
      new Plugin<boolean>({
        key: plugin,
        appendTransaction: (_, __, state) => {
          const { doc, tr, schema } = state;
          const shouldInsertNodeAtEnd = plugin.getState(state);
          const endPosition = doc.content.size;
          const type = schema.nodes[this.options.node];

          if (!shouldInsertNodeAtEnd) {
            return;
          }

          return tr.insert(endPosition, type.create());
        },
        state: {
          init: (_, state) => {
            const lastNode = state.tr.doc.lastChild;

            return !nodeEqualsType({ node: lastNode, types: disabledNodes });
          },
          apply: (tr, value) => {
            if (!tr.docChanged) {
              return value;
            }

            const lastNode = tr.doc.lastChild;

            return !nodeEqualsType({ node: lastNode, types: disabledNodes });
          },
        },
      }),
    ];
  },
});
