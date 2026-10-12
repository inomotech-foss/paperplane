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
import { IssueLinksCollapsibleContent } from "./content";
import { IssueLinksCollapsibleTitle } from "./title";
import { IssueLinksActionButton } from "./quick-action-button";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
};

export const LinksCollapsible = observer(function LinksCollapsible(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled = false } = props;
  // store hooks
  const { openWidgets, toggleOpenWidget } = useIssueDetail();
  // derived values
  const isCollapsibleOpen = openWidgets.includes("links");

  return (
    <Collapsible
      open={isCollapsibleOpen}
      onOpenChange={() => toggleOpenWidget("links")}
      trigger={<IssueLinksCollapsibleTitle issueId={issueId} />}
      trailing={isCollapsibleOpen && !disabled ? <IssueLinksActionButton disabled={disabled} /> : undefined}
    >
      <IssueLinksCollapsibleContent
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        issueId={issueId}
        disabled={disabled}
      />
    </Collapsible>
  );
});
