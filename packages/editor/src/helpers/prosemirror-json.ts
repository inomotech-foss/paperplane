/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { JSONContent } from "@tiptap/core";
import type { Mark, Node as ProseMirrorNode } from "@tiptap/pm/model";

type TMarkJSON = NonNullable<JSONContent["marks"]>[number];

const markToJSONContent = (mark: Mark): TMarkJSON => {
  const json: TMarkJSON = { type: mark.type.name };
  if (Object.keys(mark.attrs).length > 0) json.attrs = mark.attrs;
  return json;
};

/** Typed equivalent of `ProseMirrorNode.toJSON()`. */
export const nodeToJSONContent = (node: ProseMirrorNode): JSONContent => {
  const json: JSONContent = { type: node.type.name };
  if (Object.keys(node.attrs).length > 0) json.attrs = node.attrs;
  if (node.content.size > 0) {
    const content: JSONContent[] = [];
    node.content.forEach((child) => content.push(nodeToJSONContent(child)));
    json.content = content;
  }
  if (node.marks.length > 0) json.marks = node.marks.map(markToJSONContent);
  if (node.isText) json.text = node.text;
  return json;
};
