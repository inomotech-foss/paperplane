/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { PageHead } from "@/components/core/page-title";
import { WorkspaceDashboardsList } from "@/components/workspace-dashboards";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import type { Route } from "./+types/page";

export default function WorkspaceDashboardsPage({ params }: Route.ComponentProps) {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspace();
  const pageTitle = currentWorkspace?.name ? `${currentWorkspace.name} - ${t("insight_dashboards.title")}` : undefined;

  return (
    <>
      <PageHead title={pageTitle} />
      <WorkspaceDashboardsList workspaceSlug={params.workspaceSlug} />
    </>
  );
}
