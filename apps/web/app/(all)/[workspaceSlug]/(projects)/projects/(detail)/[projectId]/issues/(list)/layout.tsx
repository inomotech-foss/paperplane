/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import { Outlet } from "react-router";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ProjectFeatureGuard } from "@/components/project/features/feature-guard";
import { ProjectIssuesHeader } from "./header";
import type { Route } from "./+types/layout";
import { ProjectIssuesMobileHeader } from "./mobile-header";

export default function ProjectIssuesLayout({ params }: Route.ComponentProps) {
  return (
    <ProjectFeatureGuard feature="work_items" workspaceSlug={params.workspaceSlug} projectId={params.projectId}>
      <AppHeader header={<ProjectIssuesHeader />} mobileHeader={<ProjectIssuesMobileHeader />} />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </ProjectFeatureGuard>
  );
}
