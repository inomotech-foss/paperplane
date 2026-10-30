/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
// types
import type { TMentionHandler } from "@/types";
// extension types
import { EMentionComponentAttributeNames, getMentionComponentAttributes } from "./types";

export type MentionNodeViewProps = NodeViewProps & {
  renderComponent: TMentionHandler["renderComponent"];
};

export function MentionNodeView(props: MentionNodeViewProps) {
  const { node, renderComponent } = props;
  const attrs = getMentionComponentAttributes(node.attrs);

  return (
    <NodeViewWrapper key={attrs[EMentionComponentAttributeNames.ID]} className="mention-component inline w-fit">
      {renderComponent({
        entity_identifier: attrs[EMentionComponentAttributeNames.ENTITY_IDENTIFIER] ?? "",
        entity_name: attrs[EMentionComponentAttributeNames.ENTITY_NAME] ?? "user_mention",
      })}
    </NodeViewWrapper>
  );
}
