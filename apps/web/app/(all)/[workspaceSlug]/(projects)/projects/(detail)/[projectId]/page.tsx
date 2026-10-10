// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { observer } from "mobx-react";
import { Navigate } from "react-router";
import useSWR from "swr";
import { PROJECT_MEMBER_PREFERENCES } from "@plane/constants";
// components
import { PageHead } from "@/components/core/page-title";
import { getProjectFeatureUrl } from "@/components/project/features/features";
import { resolveProjectLanding } from "@/components/project/features/landing";
import { ProjectNoFeaturesEmptyState } from "@/components/project/features/no-features-empty-state";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import type { Route } from "./+types/page";

function ProjectLandingPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { getPartialProjectById } = useProject();
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const {
    project: { getProjectUserProperties, fetchProjectUserProperties },
  } = useMember();
  const project = getPartialProjectById(projectId);
  const role = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId);
  // Same key as ProjectAuthWrapper, so this joins its request.
  const { isLoading: isPreferencesLoading } = useSWR(
    role === undefined ? null : PROJECT_MEMBER_PREFERENCES(projectId, role),
    () => fetchProjectUserProperties(workspaceSlug, projectId),
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  if (!project || !role || isPreferencesLoading) return null;

  const preferredTab = getProjectUserProperties(projectId)?.preferences?.navigation?.default_tab;
  const landing = resolveProjectLanding(project, role, preferredTab);
  if (landing) return <Navigate to={getProjectFeatureUrl(landing, workspaceSlug, projectId)} replace />;

  return (
    <>
      <PageHead title={project.name} />
      <ProjectNoFeaturesEmptyState workspaceSlug={workspaceSlug} projectId={projectId} />
    </>
  );
}

export default observer(ProjectLandingPage);
