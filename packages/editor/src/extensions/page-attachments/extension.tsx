/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
// types
import type { TPageAttachmentsHandler } from "@/types";
// local imports
import { PageAttachmentsExtensionConfig } from "./extension-config";

type TPageAttachmentsOptions = {
  renderComponent: TPageAttachmentsHandler["renderComponent"] | undefined;
};

function PageAttachments(props: NodeViewProps) {
  const { renderComponent } = props.extension.options as TPageAttachmentsOptions;

  return (
    <NodeViewWrapper className="page-attachments-component my-2 block">
      <div contentEditable={false}>{renderComponent?.()}</div>
    </NodeViewWrapper>
  );
}

/**
 * The node stays registered even without a handler so a document editor that
 * cannot supply one still keeps the node in its schema rather than dropping it.
 */
export function PageAttachmentsExtension(handler: TPageAttachmentsHandler | undefined) {
  return PageAttachmentsExtensionConfig.extend<TPageAttachmentsOptions>({
    addOptions(this) {
      return {
        ...this.parent?.(),
        renderComponent: handler?.renderComponent,
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(PageAttachments);
    },
  });
}
