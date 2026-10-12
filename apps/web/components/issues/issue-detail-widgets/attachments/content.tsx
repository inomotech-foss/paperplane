/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
// local imports
import { IssueAttachmentItemList } from "../../attachment/attachment-item-list";
import { useAttachmentOperations } from "./helper";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
};

export const IssueAttachmentsCollapsibleContent = observer(function IssueAttachmentsCollapsibleContent(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled } = props;
  // helper
  const attachmentHelpers = useAttachmentOperations(workspaceSlug, projectId, issueId);
  return (
    <IssueAttachmentItemList
      workspaceSlug={workspaceSlug}
      projectId={projectId}
      issueId={issueId}
      disabled={disabled}
      attachmentHelpers={attachmentHelpers}
    />
  );
});
