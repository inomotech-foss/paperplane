/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { Plus, RefreshCw } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import type { TWorkspaceDashboardWidget } from "@plane/types";
import { Loader } from "@plane/ui";
// hooks
import { useWorkspaceDashboards } from "@/hooks/store/use-workspace-dashboards";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { CreateUpdateDashboardModal } from "./create-update-dashboard-modal";
import { DeleteDashboardModal, DeleteWidgetModal } from "./delete-modals";
import { WidgetCard } from "./widget-card";
import { WidgetEditorModal } from "./widget-editor-modal";

type Props = {
  workspaceSlug: string;
  dashboardId: string;
};

/** A dashboard's board of widgets, with the owner's editing actions. */
export const WorkspaceDashboardDetail = observer(function WorkspaceDashboardDetail(props: Props) {
  const { workspaceSlug, dashboardId } = props;
  const { t } = useTranslation();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { getDashboardById, getDashboardWidgets, getOptions, fetchDashboard, fetchOptions } = useWorkspaceDashboards();
  const { allowPermissions } = useUserPermissions();
  // states
  const [isWidgetEditorOpen, setIsWidgetEditorOpen] = useState(false);
  const [widgetToEdit, setWidgetToEdit] = useState<TWorkspaceDashboardWidget | undefined>(undefined);
  const [widgetToDelete, setWidgetToDelete] = useState<TWorkspaceDashboardWidget | null>(null);
  const [isEditDashboardOpen, setIsEditDashboardOpen] = useState(false);
  const [isDeleteDashboardOpen, setIsDeleteDashboardOpen] = useState(false);
  // derived values
  const dashboard = getDashboardById(dashboardId);
  const widgets = getDashboardWidgets(dashboardId);
  const options = getOptions(workspaceSlug);
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);
  const canEdit = !!dashboard && (isAdmin || dashboard.is_owner);

  const { isLoading, error } = useSWR(
    `WORKSPACE_DASHBOARD_${workspaceSlug}_${dashboardId}`,
    () => fetchDashboard(workspaceSlug, dashboardId),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  useSWR(`WORKSPACE_DASHBOARD_OPTIONS_${workspaceSlug}`, () => fetchOptions(workspaceSlug), {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });

  const refreshAll = () =>
    void mutate(
      (key) => typeof key === "string" && key.startsWith(`WORKSPACE_DASHBOARD_WIDGET_${workspaceSlug}_${dashboardId}_`)
    );

  if (error) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-13 text-tertiary">
        {t("insight_dashboards.not_found")}
      </div>
    );
  }

  if (isLoading && !dashboard) {
    return (
      <div className="p-6">
        <Loader className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Loader.Item height="340px" />
          <Loader.Item height="340px" />
          <Loader.Item height="340px" />
        </Loader>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <>
      <WidgetEditorModal
        isOpen={isWidgetEditorOpen || !!widgetToEdit}
        workspaceSlug={workspaceSlug}
        dashboardId={dashboardId}
        widget={widgetToEdit}
        options={options}
        onClose={() => {
          setIsWidgetEditorOpen(false);
          setWidgetToEdit(undefined);
        }}
      />
      <DeleteWidgetModal
        isOpen={!!widgetToDelete}
        workspaceSlug={workspaceSlug}
        widget={widgetToDelete}
        onClose={() => setWidgetToDelete(null)}
      />
      <CreateUpdateDashboardModal
        isOpen={isEditDashboardOpen}
        workspaceSlug={workspaceSlug}
        dashboard={dashboard}
        onClose={() => setIsEditDashboardOpen(false)}
      />
      <DeleteDashboardModal
        isOpen={isDeleteDashboardOpen}
        workspaceSlug={workspaceSlug}
        dashboard={dashboard}
        onClose={() => setIsDeleteDashboardOpen(false)}
        onDeleted={() => router.push(`/${workspaceSlug}/dashboards/`)}
      />
      <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate text-16 font-medium text-primary">{dashboard.name}</h2>
            {dashboard.description && <p className="text-12 text-tertiary">{dashboard.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="tertiary" size="sm" onClick={refreshAll} prependIcon={<RefreshCw className="size-3" />}>
              {t("insight_dashboards.refresh")}
            </Button>
            {canEdit && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setIsEditDashboardOpen(true)}>
                  {t("insight_dashboards.edit")}
                </Button>
                <Button
                  variant="tertiary"
                  size="sm"
                  className="text-danger-primary"
                  onClick={() => setIsDeleteDashboardOpen(true)}
                >
                  {t("insight_dashboards.delete.action")}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsWidgetEditorOpen(true)}
                  prependIcon={<Plus className="size-3" />}
                >
                  {t("insight_dashboards.widget.add")}
                </Button>
              </>
            )}
          </div>
        </div>
        {widgets.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-subtle-1 p-10 text-center">
            <div className="flex max-w-md flex-col items-center gap-2">
              <h3 className="text-14 font-medium text-primary">{t("insight_dashboards.widget.empty_title")}</h3>
              <p className="text-12 text-tertiary">{t("insight_dashboards.widget.empty_description")}</p>
              {canEdit && (
                <Button variant="primary" size="sm" onClick={() => setIsWidgetEditorOpen(true)}>
                  {t("insight_dashboards.widget.add")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {widgets.map((widget) => (
              <WidgetCard
                key={widget.id}
                workspaceSlug={workspaceSlug}
                widget={widget}
                options={options}
                canEdit={canEdit}
                onEdit={() => setWidgetToEdit(widget)}
                onDelete={() => setWidgetToDelete(widget)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
});
