/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TIssueLinkEditableFields = {
  title: string | null;
  url: string;
};

// Filled in by the server when it crawls the link.
export type TLinkMetadata = {
  title?: string | null;
  favicon?: string | null;
  favicon_url?: string | null;
  url?: string;
  error?: string;
};

export type TIssueLink = TIssueLinkEditableFields & {
  created_by_id: string | null;
  id: string;
  metadata: TLinkMetadata;
  issue_id: string;
  created_at: string;
};

export type TIssueLinkMap = {
  [issue_id: string]: TIssueLink;
};

export type TIssueLinkIdMap = {
  [issue_id: string]: string[];
};
