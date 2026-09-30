/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
// types
import type { TWorkItemEmbedHandler } from "@/types";
// local imports
import { WorkItemEmbedExtensionConfig } from "./extension-config";
import type { TWorkItemEmbedAttributes } from "./types";
import { EWorkItemEmbedAttributeNames } from "./types";

type TWorkItemEmbedOptions = {
  renderComponent: TWorkItemEmbedHandler["renderComponent"] | undefined;
};

function WorkItemEmbed(props: NodeViewProps) {
  const { renderComponent } = props.extension.options as TWorkItemEmbedOptions;
  const attrs = props.node.attrs as TWorkItemEmbedAttributes;
  const workItemId = attrs[EWorkItemEmbedAttributeNames.ENTITY_IDENTIFIER];

  return (
    <NodeViewWrapper className="issue-embed my-2 block">
      <div contentEditable={false}>
        {workItemId
          ? renderComponent?.({
              workItemId,
              projectId: attrs[EWorkItemEmbedAttributeNames.PROJECT_IDENTIFIER],
              workspaceSlug: attrs[EWorkItemEmbedAttributeNames.WORKSPACE_IDENTIFIER],
            })
          : null}
      </div>
    </NodeViewWrapper>
  );
}

/**
 * The node stays registered even without a handler so a document editor that
 * cannot supply one still keeps the node in its schema rather than dropping it.
 */
export function WorkItemEmbedExtension(handler: TWorkItemEmbedHandler | undefined) {
  return WorkItemEmbedExtensionConfig.extend<TWorkItemEmbedOptions>({
    addOptions(this) {
      return {
        ...this.parent?.(),
        renderComponent: handler?.renderComponent,
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(WorkItemEmbed);
    },
  });
}
