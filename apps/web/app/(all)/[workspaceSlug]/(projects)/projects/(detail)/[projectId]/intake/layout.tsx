/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
// components
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ProjectFeatureGuard } from "@/components/project/features/feature-guard";
import { ProjectInboxHeader } from "@/components/projects/settings/intake/header";
import type { Route } from "./+types/layout";

export default function ProjectInboxIssuesLayout({ params }: Route.ComponentProps) {
  return (
    <ProjectFeatureGuard feature="intake" workspaceSlug={params.workspaceSlug} projectId={params.projectId}>
      <AppHeader header={<ProjectInboxHeader />} />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </ProjectFeatureGuard>
  );
}
