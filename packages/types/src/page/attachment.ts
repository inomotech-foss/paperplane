/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TFileSignedURLResponse } from "../file";

export type TPageAttachment = {
  id: string;
  attributes: {
    name: string;
    size: number;
    type?: string;
  };
  asset_url: string;
  page: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export type TPageAttachmentUploadResponse = TFileSignedURLResponse & {
  attachment: TPageAttachment;
};
