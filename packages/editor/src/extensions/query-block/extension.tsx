/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
// helpers
import { isOneOf } from "@plane/types";
// types
import type { TQueryBlockHandler, TQueryBlockHandlerProps } from "@/types";
// local imports
import {
  DEFAULT_QUERY_BLOCK_KIND,
  DEFAULT_QUERY_BLOCK_SCOPE,
  QUERY_BLOCK_KINDS,
  QUERY_BLOCK_SCOPES,
  QueryBlockExtensionConfig,
} from "./extension-config";

const QUERY_BLOCK_STATUSES: readonly NonNullable<TQueryBlockHandlerProps["status"]>[] = ["complete", "incomplete"];

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

function commaList(value: unknown) {
  return (optionalString(value) ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function QueryBlock(props: NodeViewProps & TQueryBlockOptions) {
  const { renderComponent } = props;
  const attrs = props.node.attrs;
  const kind: unknown = attrs.kind;
  const scope: unknown = attrs.scope;
  const status: unknown = attrs.status;

  return (
    <NodeViewWrapper className="editor-query-block-component my-2 block">
      <div contentEditable={false}>
        {renderComponent?.({
          kind: isOneOf(QUERY_BLOCK_KINDS, kind) ? kind : DEFAULT_QUERY_BLOCK_KIND,
          scope: isOneOf(QUERY_BLOCK_SCOPES, scope) ? scope : DEFAULT_QUERY_BLOCK_SCOPE,
          rootPageId: optionalString(attrs["root-page-id"]),
          depth: optionalNumber(attrs.depth),
          limit: optionalNumber(attrs.limit),
          sort: optionalString(attrs.sort),
          reverse: attrs.reverse === "true" || attrs.reverse === true,
          labels: commaList(attrs.labels),
          placeholder: optionalString(attrs.placeholder),
          columns: commaList(attrs.columns),
          status: isOneOf(QUERY_BLOCK_STATUSES, status) ? status : undefined,
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
      const { renderComponent } = this.options;
      return ReactNodeViewRenderer((props) => <QueryBlock {...props} renderComponent={renderComponent} />);
    },
  });
}
