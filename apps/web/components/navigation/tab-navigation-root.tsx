/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
import { observer } from "mobx-react";
import { useParams, useLocation } from "react-router";
import { EUserPermissionsLevel, EUserPermissions } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Tabs, TabsList } from "@makeplane/propel/components/tabs";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { LeaveProjectModal } from "../project/leave-project-modal";
import { PublishProjectModal } from "../project/publish-project/modal";
import { getProjectNavigationItems } from "./navigation-items";
import { ProjectActionsMenu } from "./project-actions-menu";
import { ProjectHeader } from "./project-header";
import { TabNavigationOverflowMenu } from "./tab-navigation-overflow-menu";
import { TabNavigationVisibleItem } from "./tab-navigation-visible-item";
import { UnderlineTabLink } from "./underline-tab-link";
import { useActiveTab } from "./use-active-tab";
import { useProjectActions } from "./use-project-actions";
import { useResponsiveTabLayout } from "./use-responsive-tab-layout";
import { useTabPreferences } from "./use-tab-preferences";

export type TNavigationItem = {
  key: string;
  i18n_key: string;
  icon: React.ElementType;
  href: string;
};

type TTabNavigationRootProps = {
  workspaceSlug: string;
  projectId: string;
};

export const TabNavigationRoot = observer(function TabNavigationRoot(props: TTabNavigationRootProps) {
  const { workspaceSlug, projectId } = props;
  const { workItem: workItemIdentifierFromRoute } = useParams();
  const location = useLocation();
  const pathname = location.pathname;
  const { t } = useTranslation();

  // Store hooks
  const { getPartialProjectById } = useProject();
  const { allowPermissions, getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const {
    issue: { getIssueIdByIdentifier, getIssueById },
  } = useIssueDetail();

  // Tab preferences hook
  const { tabPreferences, handleToggleDefaultTab, handleHideTab, handleShowTab } = useTabPreferences(
    workspaceSlug,
    projectId
  );

  // Derived values
  const workItemId = workItemIdentifierFromRoute
    ? getIssueIdByIdentifier(workItemIdentifierFromRoute?.toString())
    : undefined;
  const workItem = workItemId ? getIssueById(workItemId) : undefined;
  const project = getPartialProjectById(projectId);

  const navigationItems = project
    ? getProjectNavigationItems(
        workspaceSlug,
        projectId,
        project,
        getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId)
      )
    : [];

  // Active tab hook
  const { isActive, activeItem } = useActiveTab({
    navigationItems,
    pathname,
    workItemId,
    workItem,
    projectId,
  });

  // Project actions hook
  const {
    publishModalOpen,
    leaveProjectModalOpen,
    handleLeaveProject,
    handleCopyText,
    handlePublishModal,
    handleLeaveProjectModal,
  } = useProjectActions({
    workspaceSlug,
    projectId,
    activeItem,
  });

  // Split items into two categories:
  // 1. visibleNavigationItems: Items NOT user-hidden (may still overflow due to space)
  // 2. hiddenNavigationItems: Items user explicitly hid (always in overflow with "Show" icon)
  const hiddenTabKeys = new Set(tabPreferences.hiddenTabs);
  const visibleNavigationItems: TNavigationItem[] = [];
  const hiddenNavigationItems: TNavigationItem[] = [];
  for (const item of navigationItems) {
    if (hiddenTabKeys.has(item.key)) hiddenNavigationItems.push(item);
    else visibleNavigationItems.push(item);
  }

  // Responsive tab layout hook
  const { visibleItems, overflowItems, hasOverflow, itemRefs, containerRef } = useResponsiveTabLayout({
    visibleNavigationItems,
    hiddenNavigationItems,
    isActive,
  });

  if (navigationItems.length === 0) return null;
  if (!project) return null;

  // Permission checks
  const isAdmin = allowPermissions(
    [EUserPermissions.ADMIN],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug.toString(),
    project?.id
  );

  const isAuthorized = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug.toString(),
    project?.id
  );

  return (
    <>
      <PublishProjectModal isOpen={publishModalOpen} projectId={projectId} onClose={() => handlePublishModal(false)} />
      <LeaveProjectModal
        project={project}
        isOpen={leaveProjectModalOpen}
        onClose={() => handleLeaveProjectModal(false)}
      />

      {/* container for the tab navigation */}
      <div className="flex size-full items-center gap-3 overflow-hidden">
        <div className="flex shrink-0 items-center gap-2">
          <ProjectHeader workspaceSlug={workspaceSlug} projectId={projectId} />
          <div className="shrink-0">
            <ProjectActionsMenu
              workspaceSlug={workspaceSlug}
              project={project}
              isAdmin={isAdmin}
              isAuthorized={isAuthorized}
              onCopyText={handleCopyText}
              onLeaveProject={handleLeaveProject}
              onPublishModal={() => handlePublishModal(true)}
            />
          </div>
        </div>

        <div className="h-5 w-1 shrink-0 border-l border-subtle" />

        <div ref={containerRef} className="flex h-full min-w-0 flex-1 items-center overflow-hidden">
          <Tabs variant="underline" value={activeItem?.key ?? null}>
            <div className="-mb-3">
              <TabsList>
                {/* Render visible tab items */}
                {visibleItems.map((item) => {
                  const originalIndex = navigationItems.indexOf(item);

                  return (
                    <TabNavigationVisibleItem
                      key={item.key}
                      item={item}
                      tabPreferences={tabPreferences}
                      onToggleDefault={handleToggleDefaultTab}
                      onHide={handleHideTab}
                      itemRef={(el) => {
                        itemRefs.current[originalIndex] = el;
                      }}
                    />
                  );
                })}

                {/* Render overflow menu if needed */}
                {hasOverflow && (
                  <TabNavigationOverflowMenu
                    overflowItems={overflowItems}
                    isActive={isActive}
                    tabPreferences={tabPreferences}
                    onToggleDefault={handleToggleDefaultTab}
                    onShow={handleShowTab}
                  />
                )}
              </TabsList>
            </div>
          </Tabs>

          {hasOverflow && (
            <div className="pointer-events-none absolute -z-10 opacity-0">
              <Tabs variant="underline" value={activeItem?.key ?? null}>
                <div className="-mb-3">
                  <TabsList>
                    {visibleNavigationItems.map((item: TNavigationItem) => {
                      const originalIndex = navigationItems.indexOf(item);
                      return (
                        <div
                          key={`measure-hidden-${item.key}`}
                          ref={(el) => {
                            itemRefs.current[originalIndex] = el;
                          }}
                          className="inline-block"
                        >
                          <UnderlineTabLink value={item.key} label={t(item.i18n_key)} to={item.href} />
                        </div>
                      );
                    })}
                  </TabsList>
                </div>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </>
  );
});
