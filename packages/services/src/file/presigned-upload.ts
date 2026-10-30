// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TFileSignedURLResponse } from "@plane/types";
import { uploadForm } from "../client/upload";
import type { UploadOptions } from "../client/upload";
import { generateFileUploadPayload } from "./helper";

/** Uploads a file straight to storage with the presigned POST form the API returned. */
export function uploadToPresignedPost(
  signedURLResponse: Pick<TFileSignedURLResponse, "upload_data">,
  file: File,
  options: UploadOptions = {}
): Promise<void> {
  return uploadForm(signedURLResponse.upload_data.url, generateFileUploadPayload(signedURLResponse, file), options);
}
