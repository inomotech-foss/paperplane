/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { EFileAssetType } from "./enums";

export type TFileMetaDataLite = {
  name: string;
  // file size in bytes
  size: number;
  type: string;
};

export type TFileEntityInfo = {
  entity_identifier: string;
  entity_type: EFileAssetType;
};

export type TFileMetaData = TFileMetaDataLite & TFileEntityInfo;

export type TFileSignedURLResponse = {
  asset_id: string;
  /** Null for the entity types the API serves through another URL. */
  asset_url: string | null;
  upload_data: {
    url: string;
    fields: Record<string, string>;
  };
};

export type TDuplicateAssetData = {
  entity_id: string;
  entity_type: EFileAssetType;
  project_id?: string;
  asset_ids: string[];
};

export type TDuplicateAssetResponse = Record<string, string>; // asset_id -> new_asset_id
