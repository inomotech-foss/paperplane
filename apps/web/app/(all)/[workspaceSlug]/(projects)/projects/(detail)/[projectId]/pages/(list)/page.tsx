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
import { PageHead } from "@/components/core/page-title";
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
