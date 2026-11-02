/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
// components
import { EUserPermissionsLevel } from "@plane/constants";
import type { IState, TStateCreatePayload, TStateOperationsCallbacks } from "@plane/types";
import { EUserProjectRoles } from "@plane/types";
import { LoadErrorState } from "@/components/common/load-error-state";
import { ProjectStateLoader, GroupList } from "@/components/project-states";
// hooks
import { useProjectStates } from "@/hooks/queries/use-state-queries";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUserPermissions } from "@/hooks/store/user";

type TProjectState = {
  workspaceSlug: string;
  projectId: string;
};

export const ProjectStateRoot = observer(function ProjectStateRoot(props: TProjectState) {
  const { workspaceSlug, projectId } = props;
  // hooks
  const { groupedProjectStates, createState, moveStatePosition, updateState, deleteState, markStateAsDefault } =
    useProjectState();
  const { allowPermissions } = useUserPermissions();
  // derived values
  const isEditable = allowPermissions(
    [EUserProjectRoles.ADMIN],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  const { isLoading, error, retry } = useProjectStates(workspaceSlug, projectId);

  // State operations callbacks
  const stateOperationsCallbacks: TStateOperationsCallbacks = useMemo(
    () => ({
      createState: async (data: TStateCreatePayload) => createState(workspaceSlug, projectId, data),
      updateState: async (stateId: string, data: Partial<IState>) =>
        updateState(workspaceSlug, projectId, stateId, data),
      deleteState: async (stateId: string) => deleteState(workspaceSlug, projectId, stateId),
      moveStatePosition: async (stateId: string, data: Partial<IState>) =>
        moveStatePosition(workspaceSlug, projectId, stateId, data),
      markStateAsDefault: async (stateId: string) => markStateAsDefault(workspaceSlug, projectId, stateId),
    }),
    [workspaceSlug, projectId, createState, moveStatePosition, updateState, deleteState, markStateAsDefault]
  );

  // Loader
  if (isLoading) return <ProjectStateLoader />;
  if (error) return <LoadErrorState onRetry={retry} />;

  return (
    <GroupList
      groupedStates={groupedProjectStates}
      stateOperationsCallbacks={stateOperationsCallbacks}
      isEditable={isEditable}
    />
  );
});
