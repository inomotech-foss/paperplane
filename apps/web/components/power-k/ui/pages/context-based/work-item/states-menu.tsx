/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Command } from "cmdk";
import { observer } from "mobx-react";
// plane types
import { useParams } from "next/navigation";
import type { TIssue } from "@plane/types";
import { Spinner } from "@plane/blocks/spinner";
// hooks
import { LoadErrorState } from "@/components/common/load-error-state";
import { useProjectStates } from "@/hooks/queries/use-state-queries";
import { useProjectState } from "@/hooks/store/use-project-state";
// local imports
import { PowerKProjectStatesMenuItems } from "./state-menu-item";

type Props = {
  handleSelect: (stateId: string) => void;
  workItemDetails: TIssue;
};

export const PowerKProjectStatesMenu = observer(function PowerKProjectStatesMenu(props: Props) {
  const { workItemDetails } = props;
  // router
  const { workspaceSlug } = useParams();
  // store hooks
  const { getProjectStates } = useProjectState();
  const { isLoading, error, retry } = useProjectStates(workspaceSlug?.toString(), workItemDetails.project_id);
  // derived values
  const filteredProjectStates = getProjectStates(workItemDetails.project_id);

  if (isLoading) return <Spinner />;
  if (error) return <LoadErrorState onRetry={retry} />;

  return (
    <Command.Group>
      <PowerKProjectStatesMenuItems
        {...props}
        projectId={workItemDetails.project_id ?? undefined}
        selectedStateId={workItemDetails.state_id ?? undefined}
        states={filteredProjectStates}
        workspaceSlug={workspaceSlug?.toString()}
      />
    </Command.Group>
  );
});
