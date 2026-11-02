/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useRef } from "react";
import { Outlet } from "react-router";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
// components
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ProjectFeatureGuard } from "@/components/project/features/feature-guard";
import {
  PROJECT_WORK_ITEMS_PAGE,
  getProjectWorkItemsBinding,
  getWorkItemPeekBinding,
} from "@/lib/work-item-view-url/bindings";
import { PqlDraftProvider } from "@/lib/work-item-view-url/pql-draft";
import { loadViewRoute, shouldRevalidateView } from "@/lib/work-item-view-url/route";
import { usePeekRoute } from "@/lib/work-item-view-url/use-peek-route";
import { useWorkItemViewRoute } from "@/lib/work-item-view-url/use-view-route";
import { ProjectIssuesHeader } from "./header";
import type { Route } from "./+types/layout";
import { ProjectIssuesMobileHeader } from "./mobile-header";

export const clientLoader = ({ request, params }: Route.ClientLoaderArgs) =>
  loadViewRoute(request, getProjectWorkItemsBinding(params.workspaceSlug, params.projectId));

export const shouldRevalidate = shouldRevalidateView;

export default function ProjectIssuesLayout({ params, loaderData }: Route.ComponentProps) {
  useWorkItemViewRoute(loaderData, PROJECT_WORK_ITEMS_PAGE, params.projectId);
  const { t } = useTranslation();
  // t changes on every render, the binding must not
  const translate = useRef(t);
  useEffect(() => {
    translate.current = t;
  });
  const peekBinding = useMemo(
    () =>
      getWorkItemPeekBinding(params.workspaceSlug, () =>
        setToast({
          type: "error",
          title: translate.current("issue.peek_not_found.title"),
          message: translate.current("issue.peek_not_found.message"),
        })
      ),
    [params.workspaceSlug]
  );
  usePeekRoute(peekBinding);
  return (
    <ProjectFeatureGuard feature="work_items" workspaceSlug={params.workspaceSlug} projectId={params.projectId}>
      <PqlDraftProvider value={loaderData.draft}>
        <AppHeader header={<ProjectIssuesHeader />} mobileHeader={<ProjectIssuesMobileHeader />} />
        <ContentWrapper>
          <Outlet />
        </ContentWrapper>
      </PqlDraftProvider>
    </ProjectFeatureGuard>
  );
}
