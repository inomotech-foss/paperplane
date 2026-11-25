/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
// plane imports
import type { TPageNavigationTabs } from "@plane/types";
// components
import { Header, EHeaderVariant } from "@plane/blocks/layout";
import { PageHead } from "@/components/core/page-title";
import { PageApprovalRegister } from "@/components/pages/approval/register";
import { PageTabNavigation } from "@/components/pages/list/tab-navigation";
import { PagesListRoot } from "@/components/pages/list/root";
import { PagesListView } from "@/components/pages/pages-list-view";
// hooks
import { useProject } from "@/hooks/store/use-project";
// plane web hooks
import { EPageStoreType } from "@/hooks/store";
import type { Route } from "./+types/page";

const getPageType = (pageType?: string | null): TPageNavigationTabs => {
  if (pageType === "private") return "private";
  if (pageType === "archived") return "archived";
  return "public";
};

function ProjectPagesPage({ params }: Route.ComponentProps) {
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const { workspaceSlug, projectId } = params;
  // store hooks
  const { getProjectById } = useProject();
  // derived values
  const project = getProjectById(projectId);
  const pageTitle = project?.name ? `${project?.name} - Pages` : undefined;
  const pageType = getPageType(type);

  if (type === "register" && project?.is_page_approval_enabled)
    return (
      <>
        <PageHead title={project?.name ? `${project.name} - Document register` : undefined} />
        <div className="relative flex h-full w-full flex-col overflow-hidden">
          <Header variant={EHeaderVariant.SECONDARY}>
            <Header.LeftItem>
              <PageTabNavigation workspaceSlug={workspaceSlug} projectId={projectId} pageType="register" />
            </Header.LeftItem>
          </Header>
          <PageApprovalRegister workspaceSlug={workspaceSlug} projectId={projectId} />
        </div>
      </>
    );

  return (
    <>
      <PageHead title={pageTitle} />
      <PagesListView
        pageType={pageType}
        projectId={projectId}
        storeType={EPageStoreType.PROJECT}
        workspaceSlug={workspaceSlug}
      >
        <PagesListRoot pageType={pageType} storeType={EPageStoreType.PROJECT} />
      </PagesListView>
    </>
  );
}

export default observer(ProjectPagesPage);
