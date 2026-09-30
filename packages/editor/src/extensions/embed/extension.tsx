/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
// types
import type { TEmbedHandler } from "@/types";
// local imports
import { EmbedExtensionConfig } from "./extension-config";

type TEmbedOptions = {
  renderComponent: TEmbedHandler["renderComponent"] | undefined;
};

function Embed(props: NodeViewProps) {
  const { renderComponent } = props.extension.options as TEmbedOptions;
  const { url, width, height } = props.node.attrs;

  const onUrlChange = props.editor.isEditable ? (newUrl: string) => props.updateAttributes({ url: newUrl }) : undefined;

  return (
    <NodeViewWrapper className="editor-embed-component my-2 block">
      <div contentEditable={false}>{renderComponent?.({ url, width, height, onUrlChange })}</div>
    </NodeViewWrapper>
  );
}

/**
 * The node stays registered even without a handler so a document editor that
 * cannot supply one still keeps the node in its schema rather than dropping it.
 */
export function EmbedExtension(handler: TEmbedHandler | undefined) {
  return EmbedExtensionConfig.extend<TEmbedOptions>({
    addOptions(this) {
      return {
        ...this.parent?.(),
        renderComponent: handler?.renderComponent,
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(Embed);
    },
  });
}
