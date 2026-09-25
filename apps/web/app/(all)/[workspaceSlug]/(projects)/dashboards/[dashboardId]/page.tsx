/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { PageHead } from "@/components/core/page-title";
import { WorkspaceDashboardDetail } from "@/components/workspace-dashboards";
// hooks
import { useWorkspaceDashboards } from "@/hooks/store/use-workspace-dashboards";
import type { Route } from "./+types/page";

export default function WorkspaceDashboardPage({ params }: Route.ComponentProps) {
  const { t } = useTranslation();
  const { getDashboardById } = useWorkspaceDashboards();
  const dashboard = getDashboardById(params.dashboardId);

  return (
    <>
      <PageHead title={dashboard?.name ?? t("insight_dashboards.title")} />
      <WorkspaceDashboardDetail workspaceSlug={params.workspaceSlug} dashboardId={params.dashboardId} />
    </>
  );
}
