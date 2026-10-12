/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { cloneElement } from "react";
import { observer } from "mobx-react";
import { AddOutline } from "@makeplane/propel/icons";
// plane imports
import type { TIssueServiceType } from "@plane/types";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";

type Props = {
  /** Rendered as the add button itself, so it must accept button props. */
  customButton?: React.ReactElement<React.ComponentPropsWithRef<"button">>;
  disabled?: boolean;
  issueServiceType: TIssueServiceType;
};

export const IssueLinksActionButton = observer(function IssueLinksActionButton(props: Props) {
  const { customButton, disabled = false, issueServiceType } = props;
  // store hooks
  const { toggleIssueLinkModal } = useIssueDetail(issueServiceType);

  // handlers
  const handleOnClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
    toggleIssueLinkModal(true);
  };

  if (customButton) return cloneElement(customButton, { onClick: handleOnClick, disabled });

  return (
    <button type="button" onClick={handleOnClick} disabled={disabled}>
      <AddOutline className="h-4 w-4" />
    </button>
  );
});
