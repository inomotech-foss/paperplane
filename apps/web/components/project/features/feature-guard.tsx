// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { Navigate } from "react-router";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import type { TProjectFeatureKey } from "./features";
import { getProjectFeature, getProjectUrl, isProjectFeatureAvailable } from "./features";

type Props = {
  feature: TProjectFeatureKey;
  workspaceSlug: string;
  projectId: string;
  children: ReactNode;
};

// Sends users to the project landing when the feature is off or not allowed for their role.
export const ProjectFeatureGuard = observer(function ProjectFeatureGuard(props: Props) {
  const { feature, workspaceSlug, projectId, children } = props;
  const { getPartialProjectById } = useProject();
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const project = getPartialProjectById(projectId);
  const role = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId);

  if (!project) return null;
  if (isProjectFeatureAvailable(getProjectFeature(feature), project, role)) return <>{children}</>;
  return <Navigate to={getProjectUrl(workspaceSlug, projectId)} replace />;
});
