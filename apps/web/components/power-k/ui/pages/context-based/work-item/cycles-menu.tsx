/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane types
import type { ICycle, TIssue } from "@plane/types";
import { Spinner } from "@plane/blocks/spinner";
// components
import { LoadErrorState } from "@/components/common/load-error-state";
import { PowerKCyclesMenu } from "@/components/power-k/menus/cycles";
// hooks
import { useProjectCycles } from "@/hooks/queries/use-cycle-queries";
import { useCycle } from "@/hooks/store/use-cycle";

type Props = {
  handleSelect: (cycle: ICycle) => void;
  workItemDetails: TIssue;
};

export const PowerKWorkItemCyclesMenu = observer(function PowerKWorkItemCyclesMenu(props: Props) {
  const { handleSelect, workItemDetails } = props;
  // store hooks
  const { workspaceSlug } = useParams();
  const { getProjectCycleIds, getCycleById } = useCycle();
  const { isLoading, error, retry } = useProjectCycles(workspaceSlug?.toString(), workItemDetails.project_id);
  // derived values
  const filteredCyclesList = workItemDetails.project_id
    ? getProjectCycleIds(workItemDetails.project_id)
        .map((cycleId) => getCycleById(cycleId))
        .filter((cycle) => !!cycle)
    : [];

  if (isLoading) return <Spinner />;
  if (error) return <LoadErrorState onRetry={retry} />;

  return <PowerKCyclesMenu cycles={filteredCyclesList} onSelect={handleSelect} value={workItemDetails.cycle_id} />;
});
