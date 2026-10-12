/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// components
import { LinkList } from "../../issue-detail/links";
// helper
import { useLinkOperations } from "./helper";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
};

export function IssueLinksCollapsibleContent(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled } = props;

  // helper
  const handleLinkOperations = useLinkOperations(workspaceSlug, projectId, issueId);

  return <LinkList issueId={issueId} linkOperations={handleLinkOperations} disabled={disabled} />;
}
