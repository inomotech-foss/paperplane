// SPDX-License-Identifier: AGPL-3.0-only

export const DOCUMENT_LOAD_TIMEOUT_REASON = "document-load-timeout";

// Hocuspocus sends `reason` to the waiting clients as the PermissionDenied reason.
export class DocumentLoadTimeoutError extends Error {
  readonly reason = DOCUMENT_LOAD_TIMEOUT_REASON;
}
