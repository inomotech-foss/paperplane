/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
// plane imports
import { CORE_EXTENSIONS } from "@plane/utils";
// helpers
import { isOneOf } from "@plane/types";
// local imports
import type { NodeFileMapType } from "../../constants/utility";

export type TFileNodeType = keyof NodeFileMapType;

export type TFileNode = {
  node: ProseMirrorNode;
  nodeType: TFileNodeType;
  src: string;
};

const FILE_NODE_TYPES: readonly TFileNodeType[] = [CORE_EXTENSIONS.IMAGE, CORE_EXTENSIONS.CUSTOM_IMAGE];

export const getFileNodeType = (node: ProseMirrorNode): TFileNodeType | undefined => {
  const name = node.type.name;
  return isOneOf(FILE_NODE_TYPES, name) ? name : undefined;
};
