/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane types
import type { ICycle } from "@plane/types";
import { Spinner } from "@plane/blocks/spinner";
// components
import { LoadErrorState } from "@/components/common/load-error-state";
import type { TPowerKContext } from "@/components/power-k/core/types";
import { PowerKCyclesMenu } from "@/components/power-k/menus/cycles";
// hooks
import { useProjectCycles } from "@/hooks/queries/use-cycle-queries";
import { useCycle } from "@/hooks/store/use-cycle";

type Props = {
  context: TPowerKContext;
  handleSelect: (cycle: ICycle) => void;
};

export const PowerKOpenProjectCyclesMenu = observer(function PowerKOpenProjectCyclesMenu(props: Props) {
  const { context, handleSelect } = props;
  // store hooks
  const { getProjectCycleIds, getCycleById } = useCycle();
  // derived values
  const projectId = context.params.projectId?.toString();
  const { isLoading, error, retry } = useProjectCycles(context.params.workspaceSlug?.toString(), projectId);
  const cyclesList = projectId
    ? getProjectCycleIds(projectId)
        .map((cycleId) => getCycleById(cycleId))
        .filter((cycle) => !!cycle)
    : [];

  if (isLoading) return <Spinner />;
  if (error) return <LoadErrorState onRetry={retry} />;

  return <PowerKCyclesMenu cycles={cyclesList} onSelect={handleSelect} />;
});
