/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslation } from "@plane/i18n";
// components
import { getProjectNavigationItems } from "@/components/navigation/navigation-items";
import type { TNavigationItem } from "@/components/navigation/tab-navigation-root";
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { ProjectSidebarLinks } from "./project-links";

type TProjectItemsProps = {
  workspaceSlug: string;
  projectId: string;
};

export const ProjectNavigation = observer(function ProjectNavigation(props: TProjectItemsProps) {
  const { workspaceSlug, projectId } = props;
  const { workItem: workItemIdentifierFromRoute } = useParams();
  // store hooks
  const { t } = useTranslation();
  const { isExtendedProjectSidebarOpened, toggleExtendedProjectSidebar, toggleSidebar } = useAppTheme();
  const { getPartialProjectById } = useProject();
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const {
    issue: { getIssueIdByIdentifier, getIssueById },
  } = useIssueDetail();
  // pathname
  const pathname = usePathname();
  // derived values
  const workItemId = workItemIdentifierFromRoute
    ? getIssueIdByIdentifier(workItemIdentifierFromRoute?.toString())
    : undefined;
  const workItem = workItemId ? getIssueById(workItemId) : undefined;
  const project = getPartialProjectById(projectId);
  // handlers
  const handleProjectClick = () => {
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
    // close the extended sidebar if it is open
    if (isExtendedProjectSidebarOpened) {
      toggleExtendedProjectSidebar(false);
    }
  };

  const isActive = useCallback(
    (item: TNavigationItem) => {
      // work item condition
      const workItemCondition = workItemId && workItem && !workItem?.is_epic && workItem?.project_id === projectId;
      // epic condition
      const epicCondition = workItemId && workItem && workItem?.is_epic && workItem?.project_id === projectId;
      // is active
      const isWorkItemActive = item.key === "work_items" && workItemCondition;
      const isEpicActive = item.key === "epics" && epicCondition;
      // pathname condition
      const isPathnameActive = pathname.includes(item.href);
      // return
      return isWorkItemActive || isEpicActive || isPathnameActive;
    },
    [pathname, workItem, workItemId, projectId]
  );

  if (!project) return null;

  const navigationItems = getProjectNavigationItems(
    workspaceSlug,
    projectId,
    project,
    getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId)
  );

  return (
    <>
      {navigationItems.map((item) => {
        const shouldShowCount = item.key === "intake" && (project.intake_count ?? 0) > 0;

        return (
          <Link key={item.key} href={item.href} onClick={handleProjectClick}>
            <SidebarNavItem isActive={!!isActive(item)}>
              <div className="flex w-full items-center justify-between gap-1.5 py-[1px]">
                <div className="flex items-center gap-1.5">
                  <item.icon
                    className={`size-4 flex-shrink-0 ${item.key === "intake" ? "stroke-1" : "stroke-[1.5]"}`}
                  />
                  <span className="text-11 font-medium">{t(item.i18n_key)}</span>
                </div>
                {shouldShowCount && <span className="text-11 font-medium text-tertiary">{project.intake_count}</span>}
              </div>
            </SidebarNavItem>
          </Link>
        );
      })}
      <ProjectSidebarLinks workspaceSlug={workspaceSlug} projectId={project.id} onInternalClick={handleProjectClick} />
    </>
  );
});
