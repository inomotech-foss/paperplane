/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { BarIcon } from "@plane/propel/icons";
import { Breadcrumbs, Header } from "@plane/ui";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
// hooks
import { useWorkspaceDashboards } from "@/hooks/store/use-workspace-dashboards";

export const WorkspaceDashboardsHeader = observer(function WorkspaceDashboardsHeader() {
  const { workspaceSlug, dashboardId } = useParams();
  const { t } = useTranslation();
  const { getDashboardById } = useWorkspaceDashboards();
  const dashboard = getDashboardById(dashboardId?.toString());

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                href={`/${workspaceSlug?.toString()}/dashboards/`}
                label={t("insight_dashboards.title")}
                icon={<BarIcon className="size-4 text-secondary" />}
              />
            }
          />
          {dashboard && <Breadcrumbs.Item component={<BreadcrumbLink label={dashboard.name} />} />}
        </Breadcrumbs>
      </Header.LeftItem>
    </Header>
  );
});
