/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
// types
import type { TQueryBlockHandler, TQueryBlockKind, TQueryBlockScope } from "@/types";
// local imports
import { DEFAULT_QUERY_BLOCK_KIND, DEFAULT_QUERY_BLOCK_SCOPE, QueryBlockExtensionConfig } from "./extension-config";

type TQueryBlockOptions = {
  renderComponent: TQueryBlockHandler["renderComponent"] | undefined;
};

function optionalNumber(value: unknown) {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed) ? parsed : undefined;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function QueryBlock(props: NodeViewProps) {
  const { renderComponent } = props.extension.options as TQueryBlockOptions;
  const attrs = props.node.attrs;

  return (
    <NodeViewWrapper className="editor-query-block-component my-2 block">
      <div contentEditable={false}>
        {renderComponent?.({
          kind: (optionalString(attrs.kind) ?? DEFAULT_QUERY_BLOCK_KIND) as TQueryBlockKind,
          scope: (optionalString(attrs.scope) ?? DEFAULT_QUERY_BLOCK_SCOPE) as TQueryBlockScope,
          rootPageId: optionalString(attrs["root-page-id"]),
          depth: optionalNumber(attrs.depth),
          limit: optionalNumber(attrs.limit),
          sort: optionalString(attrs.sort),
          reverse: attrs.reverse === "true" || attrs.reverse === true,
          labels: (optionalString(attrs.labels) ?? "")
            .split(",")
            .map((label) => label.trim())
            .filter(Boolean),
          placeholder: optionalString(attrs.placeholder),
        })}
      </div>
    </NodeViewWrapper>
  );
}

/**
 * The node stays registered even without a handler so a document editor that
 * cannot supply one still keeps the node in its schema rather than dropping it.
 */
export function QueryBlockExtension(handler: TQueryBlockHandler | undefined) {
  return QueryBlockExtensionConfig.extend<TQueryBlockOptions>({
    addOptions(this) {
      return {
        ...this.parent?.(),
        renderComponent: handler?.renderComponent,
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(QueryBlock);
    },
  });
}
