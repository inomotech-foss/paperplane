/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
// types
import type { TChildPagesHandler } from "@/types";
// local imports
import { ChildPagesExtensionConfig, DEFAULT_CHILD_PAGES_DEPTH } from "./extension-config";

type TChildPagesOptions = {
  renderComponent: TChildPagesHandler["renderComponent"] | undefined;
};

function ChildPages(props: NodeViewProps) {
  const { renderComponent } = props.extension.options as TChildPagesOptions;
  const depth = Number(props.node.attrs.depth) || DEFAULT_CHILD_PAGES_DEPTH;

  return (
    <NodeViewWrapper className="child-pages-component my-2 block">
      <div contentEditable={false}>{renderComponent?.({ depth })}</div>
    </NodeViewWrapper>
  );
}

/**
 * The node stays registered even without a handler so a document editor that
 * cannot supply one still keeps the node in its schema rather than dropping it.
 */
export function ChildPagesExtension(handler: TChildPagesHandler | undefined) {
  return ChildPagesExtensionConfig.extend<TChildPagesOptions>({
    addOptions(this) {
      return {
        ...this.parent?.(),
        renderComponent: handler?.renderComponent,
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(ChildPages);
    },
  });
}
