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
// local components
import type { Route } from "./+types/layout";
import { PagesListHeader } from "./header";

export default function ProjectPagesListLayout({ params }: Route.ComponentProps) {
  return (
    <ProjectFeatureGuard feature="pages" workspaceSlug={params.workspaceSlug} projectId={params.projectId}>
      <AppHeader header={<PagesListHeader />} />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </ProjectFeatureGuard>
  );
}
