/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
// helpers
import { readString } from "@/helpers/narrow";
// types
import type { TWorkItemEmbedHandler } from "@/types";
// local imports
import { WorkItemEmbedExtensionConfig } from "./extension-config";
import { EWorkItemEmbedAttributeNames } from "./types";

type TWorkItemEmbedOptions = {
  renderComponent: TWorkItemEmbedHandler["renderComponent"] | undefined;
};

function WorkItemEmbed(props: NodeViewProps & TWorkItemEmbedOptions) {
  const { renderComponent } = props;
  const { attrs } = props.node;
  const workItemId = readString(attrs, EWorkItemEmbedAttributeNames.ENTITY_IDENTIFIER);

  return (
    <NodeViewWrapper className="issue-embed my-2 block">
      <div contentEditable={false}>
        {workItemId
          ? renderComponent?.({
              workItemId,
              projectId: readString(attrs, EWorkItemEmbedAttributeNames.PROJECT_IDENTIFIER),
              workspaceSlug: readString(attrs, EWorkItemEmbedAttributeNames.WORKSPACE_IDENTIFIER),
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
      const { renderComponent } = this.options;
      return ReactNodeViewRenderer((props) => <WorkItemEmbed {...props} renderComponent={renderComponent} />);
    },
  });
}
