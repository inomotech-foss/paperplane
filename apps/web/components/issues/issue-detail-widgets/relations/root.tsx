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
import { RelationsCollapsibleContent } from "./content";
import { RelationsCollapsibleTitle } from "./title";
import { RelationActionButton } from "./quick-action-button";

type Props = {
  workspaceSlug: string;
  issueId: string;
  disabled?: boolean;
};

export const RelationsCollapsible = observer(function RelationsCollapsible(props: Props) {
  const { workspaceSlug, issueId, disabled = false } = props;
  // store hooks
  const { openWidgets, toggleOpenWidget } = useIssueDetail();
  // derived values
  const isCollapsibleOpen = openWidgets.includes("relations");

  return (
    <Collapsible
      open={isCollapsibleOpen}
      onOpenChange={() => toggleOpenWidget("relations")}
      trigger={<RelationsCollapsibleTitle issueId={issueId} />}
      trailing={
        isCollapsibleOpen && !disabled ? <RelationActionButton issueId={issueId} disabled={disabled} /> : undefined
      }
    >
      <RelationsCollapsibleContent workspaceSlug={workspaceSlug} issueId={issueId} disabled={disabled} />
    </Collapsible>
  );
});
