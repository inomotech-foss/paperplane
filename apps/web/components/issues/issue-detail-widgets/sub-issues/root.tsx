/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
// plane imports
import { Collapsible } from "@makeplane/propel/components/collapsible";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local imports
import { SubIssuesCollapsibleContent } from "./content";
import { SubIssuesCollapsibleTitle } from "./title";
import { SubWorkItemTitleActions } from "./title-actions";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
};

export const SubIssuesCollapsible = observer(function SubIssuesCollapsible(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled = false } = props;
  // store hooks
  const { openWidgets, toggleOpenWidget } = useIssueDetail();
  // derived values
  const isCollapsibleOpen = openWidgets.includes("sub-work-items");

  return (
    <Collapsible
      open={isCollapsibleOpen}
      onOpenChange={() => toggleOpenWidget("sub-work-items")}
      trigger={<SubIssuesCollapsibleTitle parentIssueId={issueId} />}
      trailing={
        isCollapsibleOpen ? (
          <SubWorkItemTitleActions projectId={projectId} parentId={issueId} disabled={disabled} />
        ) : undefined
      }
    >
      <SubIssuesCollapsibleContent
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        parentIssueId={issueId}
        disabled={disabled}
      />
    </Collapsible>
  );
});
