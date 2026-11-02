/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane types
import type { IIssueLabel, TIssue } from "@plane/types";
import { Spinner } from "@plane/blocks/spinner";
// components
import { LoadErrorState } from "@/components/common/load-error-state";
import { PowerKLabelsMenu } from "@/components/power-k/menus/labels";
// hooks
import { useProjectLabels } from "@/hooks/queries/use-label-queries";
import { useLabel } from "@/hooks/store/use-label";

type Props = {
  handleSelect: (label: IIssueLabel) => void;
  workItemDetails: TIssue;
};

export const PowerKWorkItemLabelsMenu = observer(function PowerKWorkItemLabelsMenu(props: Props) {
  const { handleSelect, workItemDetails } = props;
  // router
  const { workspaceSlug } = useParams();
  // store hooks
  const { getProjectLabels } = useLabel();
  const { isLoading, error, retry } = useProjectLabels(workspaceSlug?.toString(), workItemDetails.project_id);
  // derived values
  const labelsList = getProjectLabels(workItemDetails.project_id);

  if (isLoading) return <Spinner />;
  if (error) return <LoadErrorState onRetry={retry} />;

  return <PowerKLabelsMenu labels={labelsList} onSelect={handleSelect} value={workItemDetails.label_ids} />;
});
