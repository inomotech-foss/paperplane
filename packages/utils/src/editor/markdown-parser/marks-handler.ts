/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Handle } from "hast-util-to-mdast";
import type { Text as MDASTText } from "mdast";
// local imports
import { createTextNode } from "./common";

const processMarkElement = (state: Parameters<Handle>[0], node: Parameters<Handle>[1], wrapper: string): MDASTText => {
  if (node.children && node.children.length > 0) {
    // Collect the text content of all children
    const texts: string[] = [];

    for (const child of node.children) {
      if (child.type === "text") {
        texts.push(child.value);
      } else if (child.type === "element") {
        // Element child - recursively process it
        const processed = state.one(child, node);
        for (const item of [processed ?? []].flat()) {
          if (item.type === "text") texts.push(item.value);
        }
      }
    }

    // Concatenate all text content and wrap with the specified wrapper
    const combinedText = texts.join("");

    return createTextNode(`${wrapper}${combinedText}${wrapper}`);
  }

  // Empty element - return empty text
  return createTextNode("");
};

export const parseMarks: Record<string, Handle> = {
  u: (state, node) => processMarkElement(state, node, ""),
  i: (state, node) => processMarkElement(state, node, "_"),
  em: (state, node) => processMarkElement(state, node, "_"),
};
