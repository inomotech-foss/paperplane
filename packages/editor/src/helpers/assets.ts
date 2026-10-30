/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
// plane imports
import type { ADDITIONAL_EXTENSIONS } from "@plane/utils";
import { CORE_EXTENSIONS } from "@plane/utils";
// extensions
import { getImageBlockId } from "@/extensions/custom-image/utils";
import { readString } from "@/helpers/narrow";
// plane editor imports
import { ADDITIONAL_ASSETS_META_DATA_RECORD } from "@/constants/assets";
// types
import type { TEditorAsset } from "@/types";

export type TAssetMetaDataRecord = (attrs: ProseMirrorNode["attrs"]) => TEditorAsset | undefined;

const getImageAssetMetaData = (
  attrs: ProseMirrorNode["attrs"],
  type: CORE_EXTENSIONS.IMAGE | CORE_EXTENSIONS.CUSTOM_IMAGE
): TEditorAsset | undefined => {
  const src = readString(attrs, "src");
  if (!src) return;
  const id = readString(attrs, "id") ?? "";
  return {
    href: `#${getImageBlockId(id)}`,
    id,
    name: `image-${id}`,
    src,
    type,
  };
};

export const CORE_ASSETS_META_DATA_RECORD: Partial<
  Record<CORE_EXTENSIONS | ADDITIONAL_EXTENSIONS, TAssetMetaDataRecord>
> = {
  [CORE_EXTENSIONS.IMAGE]: (attrs) => getImageAssetMetaData(attrs, CORE_EXTENSIONS.IMAGE),
  [CORE_EXTENSIONS.CUSTOM_IMAGE]: (attrs) => getImageAssetMetaData(attrs, CORE_EXTENSIONS.CUSTOM_IMAGE),
  ...ADDITIONAL_ASSETS_META_DATA_RECORD,
};
