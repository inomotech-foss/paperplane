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
import { PROJECT_WORK_ITEMS_PAGE, getProjectWorkItemsBinding } from "@/lib/work-item-view-url/bindings";
import { PqlDraftProvider } from "@/lib/work-item-view-url/pql-draft";
import { loadViewRoute, shouldRevalidateView } from "@/lib/work-item-view-url/route";
import { useWorkItemViewRoute } from "@/lib/work-item-view-url/use-view-route";
import { ProjectIssuesHeader } from "./header";
import type { Route } from "./+types/layout";
import { ProjectIssuesMobileHeader } from "./mobile-header";

export const clientLoader = ({ request, params }: Route.ClientLoaderArgs) =>
  loadViewRoute(request, getProjectWorkItemsBinding(params.workspaceSlug, params.projectId));

export const shouldRevalidate = shouldRevalidateView;

function ProjectIssuesLayout({ params, loaderData }: Route.ComponentProps) {
  const pqlDraft = useWorkItemViewRoute(loaderData, PROJECT_WORK_ITEMS_PAGE, params.projectId);
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
