/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Outlet } from "react-router";
// components
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ProjectFeatureGuard } from "@/components/project/features/feature-guard";
import { PqlDraftProvider } from "@/lib/work-item-view-url/pql-draft";
import { shouldRevalidateView } from "@/lib/work-item-view-url/route";
import { ProjectIssuesHeader } from "./header";
import type { Route } from "./+types/layout";
import { ProjectIssuesMobileHeader } from "./mobile-header";
import { loadProjectWorkItemsView, useProjectWorkItemsViewRoute } from "./view-url";

export const clientLoader = ({ request, params }: Route.ClientLoaderArgs) =>
  loadProjectWorkItemsView(request, params.workspaceSlug, params.projectId);

export const shouldRevalidate = shouldRevalidateView;

function ProjectIssuesLayout({ params, loaderData }: Route.ComponentProps) {
  const { pqlDraft } = useProjectWorkItemsViewRoute(loaderData, params.projectId);
  return (
    <ProjectFeatureGuard feature="work_items" workspaceSlug={params.workspaceSlug} projectId={params.projectId}>
      <PqlDraftProvider value={pqlDraft}>
        <AppHeader header={<ProjectIssuesHeader />} mobileHeader={<ProjectIssuesMobileHeader />} />
        <ContentWrapper>
          <Outlet />
        </ContentWrapper>
      </PqlDraftProvider>
    </ProjectFeatureGuard>
  );
}

export default observer(ProjectIssuesLayout);
