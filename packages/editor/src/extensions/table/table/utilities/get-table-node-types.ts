/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeType } from "@tiptap/pm/model";
import type { Schema } from "@tiptap/pm/model";
// helpers
import { isRecord } from "@plane/types";

const isNodeTypeRecord = (value: unknown): value is { [key: string]: NodeType } =>
  isRecord(value) && Object.values(value).every((item) => item instanceof NodeType);

export function getTableNodeTypes(schema: Schema): { [key: string]: NodeType } {
  const cached: unknown = schema.cached.tableNodeTypes;
  if (isNodeTypeRecord(cached)) {
    return cached;
  }

  const roles: { [key: string]: NodeType } = {};

  Object.keys(schema.nodes).forEach((type) => {
    const nodeType = schema.nodes[type];
    const tableRole: unknown = nodeType.spec.tableRole;

    if (typeof tableRole === "string" && tableRole) {
      roles[tableRole] = nodeType;
    }
  });

  schema.cached.tableNodeTypes = roles;

  return roles;
}
