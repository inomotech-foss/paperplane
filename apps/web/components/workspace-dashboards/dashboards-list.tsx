/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { LayoutDashboard, Lock, Pencil, Trash2 } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import type { TWorkspaceDashboard } from "@plane/types";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { MoreHorizontalOutline } from "@makeplane/propel/icons";
import { Loader } from "@plane/blocks/skeleton";
// hooks
import { useWorkspaceDashboards } from "@/hooks/store/use-workspace-dashboards";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { CreateUpdateDashboardModal } from "./create-update-dashboard-modal";
import { DeleteDashboardModal } from "./delete-modals";

type Props = {
  workspaceSlug: string;
};

/** Every dashboard the member may open, with the owner's actions. */
export const WorkspaceDashboardsList = observer(function WorkspaceDashboardsList(props: Props) {
  const { workspaceSlug } = props;
  const { t } = useTranslation();
  const router = useRouter();
  const { getWorkspaceDashboards, fetchDashboards } = useWorkspaceDashboards();
  const { allowPermissions } = useUserPermissions();
  // states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [dashboardToEdit, setDashboardToEdit] = useState<TWorkspaceDashboard | undefined>(undefined);
  const [dashboardToDelete, setDashboardToDelete] = useState<TWorkspaceDashboard | null>(null);
  // derived values
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);
  const canCreate = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  const dashboards = getWorkspaceDashboards(workspaceSlug);

  useSWR(`WORKSPACE_DASHBOARDS_${workspaceSlug}`, () => fetchDashboards(workspaceSlug), {
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });

  return (
    <>
      <CreateUpdateDashboardModal
        isOpen={isCreateOpen || !!dashboardToEdit}
        workspaceSlug={workspaceSlug}
        dashboard={dashboardToEdit}
        onClose={() => {
          setIsCreateOpen(false);
          setDashboardToEdit(undefined);
        }}
        onCreated={(dashboard) => router.push(`/${workspaceSlug}/dashboards/${dashboard.id}/`)}
      />
      <DeleteDashboardModal
        isOpen={!!dashboardToDelete}
        workspaceSlug={workspaceSlug}
        dashboard={dashboardToDelete}
        onClose={() => setDashboardToDelete(null)}
      />
      <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <h2 className="text-16 font-medium text-primary">{t("insight_dashboards.title")}</h2>
            <p className="text-12 text-tertiary">{t("insight_dashboards.description")}</p>
          </div>
          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              stretch="auto"
              label={t("insight_dashboards.create")}
            />
          )}
        </div>
        {!dashboards ? (
          <Loader className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Loader.Item height="96px" />
            <Loader.Item height="96px" />
            <Loader.Item height="96px" />
          </Loader>
        ) : dashboards.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-subtle-1 p-10 text-center">
            <div className="flex max-w-sm flex-col items-center gap-2">
              <LayoutDashboard className="size-8 text-tertiary" />
              <h3 className="text-14 font-medium text-primary">{t("insight_dashboards.empty.title")}</h3>
              <p className="text-12 text-tertiary">{t("insight_dashboards.empty.description")}</p>
              {canCreate && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateOpen(true)}
                  stretch="auto"
                  label={t("insight_dashboards.create")}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dashboards.map((dashboard) => {
              const canEdit = isAdmin || dashboard.is_owner;
              return (
                <div
                  key={dashboard.id}
                  className="group relative flex flex-col gap-2 rounded-lg border border-subtle-1 bg-surface-1 p-4 hover:border-strong-1"
                >
                  <button
                    type="button"
                    className="flex flex-col gap-1 text-left outline-none"
                    onClick={() => router.push(`/${workspaceSlug}/dashboards/${dashboard.id}/`)}
                  >
                    <span className="flex items-center gap-2 text-14 font-medium text-primary">
                      <LayoutDashboard className="size-4 text-tertiary" />
                      <span className="truncate">{dashboard.name}</span>
                      {dashboard.access === 0 && <Lock className="size-3 text-tertiary" />}
                    </span>
                    <span className="line-clamp-2 text-12 text-tertiary">
                      {dashboard.description || t("insight_dashboards.no_description")}
                    </span>
                    <span className="text-11 text-tertiary">
                      {t("insight_dashboards.widget_count").replace("{count}", String(dashboard.widget_count ?? 0))}
                    </span>
                  </button>
                  {canEdit && (
                    <div className="absolute top-3 right-3">
                      <Menu>
                        <MenuTrigger
                          render={
                            <IconButton
                              variant="ghost"
                              size="sm"
                              aria-label={t("aria_labels.common.more_actions")}
                              icon={<Icon icon={MoreHorizontalOutline} />}
                            />
                          }
                        />
                        <MenuContent side="bottom" align="end">
                          <MenuItem
                            icon={<Icon icon={Pencil} />}
                            label={t("insight_dashboards.edit")}
                            onClick={() => setDashboardToEdit(dashboard)}
                          />
                          <MenuItem
                            variant="danger"
                            icon={<Icon icon={Trash2} />}
                            label={t("insight_dashboards.delete.action")}
                            onClick={() => setDashboardToDelete(dashboard)}
                          />
                        </MenuContent>
                      </Menu>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
});
