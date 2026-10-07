/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Outlet } from "react-router";
import { EStartOfTheWeek } from "@plane/types";
// components
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ProjectFeatureGuard } from "@/components/project/features/feature-guard";
import { useUserProfile } from "@/hooks/store/user";
import { parseViewRequest, shouldRevalidateView } from "@/lib/work-item-view-url/route";
import { WorkItemViewUrlProvider, useWorkItemViewUrl } from "@/lib/work-item-view-url/provider";
import { ProjectIssuesHeader } from "./header";
import type { Route } from "./+types/layout";
import { ProjectIssuesMobileHeader } from "./mobile-header";
import { PROJECT_WORK_ITEMS_PAGE, useProjectViewUrlAdapter } from "./view-url";

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  return { view: parseViewRequest(request, PROJECT_WORK_ITEMS_PAGE) };
}

export const shouldRevalidate = shouldRevalidateView;

const ProjectIssuesContent = observer(function ProjectIssuesContent() {
  // the header and list wait for the URL so they never show the saved preferences first
  const ready = useWorkItemViewUrl()?.ready ?? false;
  return (
    <>
      <AppHeader
        header={<ProjectIssuesHeader showFilters={ready} />}
        mobileHeader={ready ? <ProjectIssuesMobileHeader /> : undefined}
      />
      <ContentWrapper>{ready && <Outlet />}</ContentWrapper>
    </>
  );
});

function ProjectIssuesLayout({ params, loaderData }: Route.ComponentProps) {
  const adapter = useProjectViewUrlAdapter(params.workspaceSlug, params.projectId);
  const { data: profile } = useUserProfile();
  return (
    <ProjectFeatureGuard feature="work_items" workspaceSlug={params.workspaceSlug} projectId={params.projectId}>
      <WorkItemViewUrlProvider
        adapter={adapter}
        parsed={loaderData.view}
        weekStart={profile?.start_of_the_week ?? EStartOfTheWeek.SUNDAY}
      >
        <ProjectIssuesContent />
      </WorkItemViewUrlProvider>
    </ProjectFeatureGuard>
  );
}

export default observer(ProjectIssuesLayout);
