/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ProjectFeatureGuard } from "@/components/project/features/feature-guard";
// local components
import { ProjectViewIssuesHeader } from "./[viewId]/header";
import type { Route } from "./+types/layout";

export default function ProjectViewIssuesLayout({ params }: Route.ComponentProps) {
  return (
    <ProjectFeatureGuard feature="views" workspaceSlug={params.workspaceSlug} projectId={params.projectId}>
      <AppHeader header={<ProjectViewIssuesHeader />} />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </ProjectFeatureGuard>
  );
}
