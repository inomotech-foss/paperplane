/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Link } from "react-router";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TAutomation } from "@plane/types";
import { CustomMenu, ToggleSwitch } from "@plane/ui";
import { renderFormattedDate } from "@plane/utils";
// hooks
import { useAutomation } from "@/hooks/store/use-automation";
import { useProject } from "@/hooks/store/use-project";
// local imports
import { AutomationCreateModal } from "../create-modal";
import { AutomationDeleteModal } from "../delete-modal";
import { findTrigger, useAutomationMetadata } from "../helpers/metadata";

type Props = {
  workspaceSlug: string;
  /** Omitted for the workspace-level list. */
  projectId?: string;
  automations: TAutomation[];
  disabled?: boolean;
};

const STATUS_CLASS: Record<string, string> = {
  success: "text-success-primary",
  failed: "text-danger-primary",
  partial: "text-warning-primary",
  skipped: "text-tertiary",
};

const AutomationRow = observer(function AutomationRow(props: {
  workspaceSlug: string;
  projectId?: string;
  automation: TAutomation;
  disabled?: boolean;
}) {
  const { workspaceSlug, projectId, automation, disabled } = props;
  const { t } = useTranslation();
  const { updateAutomation } = useAutomation();
  const { metadata } = useAutomationMetadata(workspaceSlug);
  const { getPartialProjectById } = useProject();
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const trigger = findTrigger(metadata, automation.trigger_type);
  const designerHref = projectId
    ? `/${workspaceSlug}/settings/projects/${projectId}/automations/${automation.id}/`
    : `/${workspaceSlug}/settings/automations/${automation.id}/`;

  const handleToggle = async () => {
    try {
      await updateAutomation(workspaceSlug, automation.id, { is_enabled: !automation.is_enabled }, projectId);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("automations.toasts.enable.error.title"),
        message: (error as { is_enabled?: string })?.is_enabled ?? t("automations.enable.validation.required"),
      });
    }
  };

  return (
    <>
      <AutomationCreateModal
        isOpen={isRenaming}
        onClose={() => setIsRenaming(false)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        automation={automation}
      />
      <AutomationDeleteModal
        isOpen={isDeleting}
        onClose={() => setIsDeleting(false)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        automation={automation}
      />

      <tr className="border-b border-subtle last:border-b-0 hover:bg-layer-1">
        <td className="px-4 py-3">
          <Link to={designerHref} className="block min-w-0">
            <span className="block truncate text-13 font-medium text-primary">{automation.name}</span>
            {trigger && <span className="block truncate text-11 text-tertiary">{t(trigger.i18n_label)}</span>}
          </Link>
        </td>
        {!projectId && (
          <td className="px-4 py-3 text-12 text-tertiary">
            {automation.applies_to_all_projects
              ? t("automations.global_automations.table.scope.project.all")
              : automation.projects.length === 1
                ? (getPartialProjectById(automation.projects[0])?.name ??
                  t("automations.global_automations.table.scope.project.label"))
                : t("automations.global_automations.table.scope.project.multiple")}
          </td>
        )}
        <td className="px-4 py-3 text-12 text-tertiary">{automation.total_run_count}</td>
        <td className="px-4 py-3 text-12">
          {automation.last_run_status ? (
            <span className={STATUS_CLASS[automation.last_run_status] ?? "text-tertiary"}>
              {t(`automations.run_history.status_${automation.last_run_status}`)}
            </span>
          ) : (
            <span className="text-tertiary">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-12 text-tertiary">
          {automation.last_run_at ? renderFormattedDate(automation.last_run_at) : "—"}
        </td>
        <td className="px-4 py-3 text-12 text-tertiary">{renderFormattedDate(automation.created_at)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            <ToggleSwitch value={automation.is_enabled} onChange={handleToggle} size="sm" disabled={disabled} />
            <CustomMenu
              customButton={
                <span className="grid size-6 place-items-center rounded-sm text-tertiary hover:bg-layer-2">
                  <MoreHorizontal className="size-4" />
                </span>
              }
              placement="bottom-end"
              closeOnSelect
            >
              <CustomMenu.MenuItem onClick={() => setIsRenaming(true)} disabled={disabled}>
                <span className="flex items-center gap-2">
                  <Pencil className="size-3.5" />
                  {t("common.update")}
                </span>
              </CustomMenu.MenuItem>
              <CustomMenu.MenuItem onClick={() => setIsDeleting(true)} disabled={disabled}>
                <span className="flex items-center gap-2 text-danger-primary">
                  <Trash2 className="size-3.5" />
                  {t("common.delete")}
                </span>
              </CustomMenu.MenuItem>
            </CustomMenu>
          </div>
        </td>
      </tr>
    </>
  );
});

export const AutomationsTable = observer(function AutomationsTable(props: Props) {
  const { workspaceSlug, projectId, automations, disabled } = props;
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto rounded-lg border border-subtle">
      <table className="w-full min-w-160 border-collapse text-left">
        <thead>
          <tr className="border-b border-subtle bg-surface-2">
            <th className="px-4 py-2.5 text-11 font-medium tracking-wide text-tertiary uppercase">
              {t("automations.table.title")}
            </th>
            {!projectId && (
              <th className="px-4 py-2.5 text-11 font-medium tracking-wide text-tertiary uppercase">
                {t("automations.table.projects")}
              </th>
            )}
            <th className="px-4 py-2.5 text-11 font-medium tracking-wide text-tertiary uppercase">
              {t("automations.table.executions")}
            </th>
            <th className="px-4 py-2.5 text-11 font-medium tracking-wide text-tertiary uppercase">
              {t("automations.table.last_run_status")}
            </th>
            <th className="px-4 py-2.5 text-11 font-medium tracking-wide text-tertiary uppercase">
              {t("automations.table.last_run_on")}
            </th>
            <th className="px-4 py-2.5 text-11 font-medium tracking-wide text-tertiary uppercase">
              {t("automations.table.created_on")}
            </th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {automations.map((automation) => (
            <AutomationRow
              key={automation.id}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              automation={automation}
              disabled={disabled}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});
