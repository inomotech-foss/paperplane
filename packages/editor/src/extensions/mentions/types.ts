/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Attrs } from "@tiptap/pm/model";
// plane types
import type { TSearchEntities } from "@plane/types";
// helpers
import { isOneOf, readString } from "@plane/types";

export enum EMentionComponentAttributeNames {
  ID = "id",
  ENTITY_IDENTIFIER = "entity_identifier",
  ENTITY_NAME = "entity_name",
  AUTHOR = "author",
}

export type TMentionComponentAttributes = {
  [EMentionComponentAttributeNames.ID]: string | null;
  [EMentionComponentAttributeNames.ENTITY_IDENTIFIER]: string | null;
  [EMentionComponentAttributeNames.ENTITY_NAME]: TSearchEntities | null;
  [EMentionComponentAttributeNames.AUTHOR]: string | null;
};

const SEARCH_ENTITIES: readonly TSearchEntities[] = ["user_mention", "issue", "project", "cycle", "module", "page"];

export const getMentionComponentAttributes = (attrs: Attrs): TMentionComponentAttributes => {
  const entityName: unknown = attrs[EMentionComponentAttributeNames.ENTITY_NAME];
  return {
    [EMentionComponentAttributeNames.ID]: readString(attrs, EMentionComponentAttributeNames.ID) ?? null,
    [EMentionComponentAttributeNames.ENTITY_IDENTIFIER]:
      readString(attrs, EMentionComponentAttributeNames.ENTITY_IDENTIFIER) ?? null,
    [EMentionComponentAttributeNames.ENTITY_NAME]: isOneOf(SEARCH_ENTITIES, entityName) ? entityName : null,
    [EMentionComponentAttributeNames.AUTHOR]: readString(attrs, EMentionComponentAttributeNames.AUTHOR) ?? null,
  };
};
