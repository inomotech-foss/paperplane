/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { GANTT_TIMELINE_TYPE, readNumber } from "@plane/types";
import type { TProject } from "@plane/types";
// components
import { ProjectAccessRestriction } from "@/components/auth-screens/project/project-access-restriction";
import { isProjectFeatureEnabled } from "@/components/settings/project/work-items-dependency";
import {
  PROJECT_DETAILS,
  PROJECT_ME_INFORMATION,
  PROJECT_CUSTOM_PROPERTIES,
  PROJECT_CUSTOM_PROPERTY_VALUES,
  PROJECT_ISSUE_TYPES,
  PROJECT_LABELS,
  PROJECT_MEMBERS,
  PROJECT_MEMBER_PREFERENCES,
  PROJECT_STATES,
  PROJECT_ESTIMATES,
  PROJECT_INTAKE_STATE,
} from "@plane/constants";
// hooks
import { useProjectCycles } from "@/hooks/queries/use-cycle-queries";
import { useProjectModules } from "@/hooks/queries/use-module-queries";
import { useProjectViews } from "@/hooks/queries/use-project-view-queries";
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useIssueCustomProperties } from "@/hooks/store/use-issue-custom-properties";
import { useIssueTypes } from "@/hooks/store/use-issue-types";
import { useLabel } from "@/hooks/store/use-label";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useTimeLineChart } from "@/hooks/use-timeline-chart";

interface IProjectAuthWrapper {
  workspaceSlug: string;
  projectId: string;
  children: ReactNode;
  isLoading?: boolean;
}

export const ProjectAuthWrapper = observer(function ProjectAuthWrapper(props: IProjectAuthWrapper) {
  const { workspaceSlug, projectId, children, isLoading: isParentLoading = false } = props;
  // states
  const [isJoiningProject, setIsJoiningProject] = useState(false);
  // store hooks
  const { fetchUserProjectInfo, allowPermissions, getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const { fetchProjectDetails, getProjectById } = useProject();
  const { joinProject } = useUserPermissions();
  const { initGantt } = useTimeLineChart(GANTT_TIMELINE_TYPE.MODULE);
  const {
    project: { fetchProjectMembers, fetchProjectUserProperties, getProjectUserProperties },
  } = useMember();
  const { fetchProjectStates, fetchProjectIntakeState } = useProjectState();
  const { data: currentUserData } = useUser();
  const { fetchProjectLabels } = useLabel();
  const { fetchProjectProperties, fetchBulkValues } = useIssueCustomProperties();
  const { fetchProjectIssueTypes } = useIssueTypes();
  const { getProjectEstimates } = useProjectEstimates();
  // derived values
  const hasPermissionToCurrentProject = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );
  const currentProjectRole = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId);
  const isWorkspaceAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  const isIntakeEnabled = isProjectFeatureEnabled(getProjectById(projectId), "inbox_view");
  // Wait for the role so the keys do not change and refetch when it resolves.
  const roleKey = (key: (projectId: string, role: EUserPermissions | undefined) => string) =>
    currentProjectRole === undefined ? null : key(projectId, currentProjectRole);
  // Initialize module timeline chart
  useEffect(() => {
    initGantt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fetching project details
  const { isLoading: isProjectDetailsLoading, error: projectDetailsError } = useSWR<TProject, unknown>(
    PROJECT_DETAILS(workspaceSlug, projectId),
    () => fetchProjectDetails(workspaceSlug, projectId)
  );
  // fetching user project member information
  useSWR(PROJECT_ME_INFORMATION(workspaceSlug, projectId), () => fetchUserProjectInfo(workspaceSlug, projectId));
  // fetching project member preferences
  useSWR(
    currentUserData?.id ? roleKey(PROJECT_MEMBER_PREFERENCES) : null,
    // the work items route may have loaded them already
    currentUserData?.id
      ? () => getProjectUserProperties(projectId) ?? fetchProjectUserProperties(workspaceSlug, projectId)
      : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );
  // fetching project labels
  useSWR(roleKey(PROJECT_LABELS), () => fetchProjectLabels(workspaceSlug, projectId), {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });
  // fetching project custom properties and their values on all work items
  useSWR(roleKey(PROJECT_CUSTOM_PROPERTIES), () => fetchProjectProperties(workspaceSlug, projectId), {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });
  useSWR(roleKey(PROJECT_CUSTOM_PROPERTY_VALUES), () => fetchBulkValues(workspaceSlug, projectId), {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });
  // fetching project work item types
  useSWR(roleKey(PROJECT_ISSUE_TYPES), () => fetchProjectIssueTypes(workspaceSlug, projectId), {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });
  // fetching project members
  useSWR(roleKey(PROJECT_MEMBERS), () => fetchProjectMembers(workspaceSlug, projectId), {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });
  // fetching project states
  useSWR(roleKey(PROJECT_STATES), () => fetchProjectStates(workspaceSlug, projectId), {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });
  // fetching project intake state
  useSWR(
    isIntakeEnabled ? roleKey(PROJECT_INTAKE_STATE) : null,
    () => fetchProjectIntakeState(workspaceSlug, projectId),
    { revalidateIfStale: false, revalidateOnFocus: false }
  );
  // fetching project estimates
  useSWR(roleKey(PROJECT_ESTIMATES), () => getProjectEstimates(workspaceSlug, projectId), {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });
  useProjectCycles(workspaceSlug, projectId);
  useProjectModules(workspaceSlug, projectId);
  useProjectViews(workspaceSlug, projectId);

  // handle join project
  const handleJoinProject = () => {
    setIsJoiningProject(true);
    joinProject(workspaceSlug, projectId).finally(() => setIsJoiningProject(false));
  };

  const isProjectLoading = (isParentLoading || isProjectDetailsLoading) && !projectDetailsError;

  if (isProjectLoading) return null;

  if (!isProjectLoading && hasPermissionToCurrentProject === false) {
    return (
      <ProjectAccessRestriction
        errorStatusCode={readNumber(projectDetailsError, "status")}
        isWorkspaceAdmin={isWorkspaceAdmin}
        handleJoinProject={handleJoinProject}
        isJoinButtonDisabled={isJoiningProject}
      />
    );
  }

  return <>{children}</>;
});
