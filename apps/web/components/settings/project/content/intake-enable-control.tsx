// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { Switch } from "@makeplane/propel/components/switch";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
// components
import { IssueTypeDropdown } from "@/components/dropdowns/issue-type";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectIssueTypes } from "@/hooks/use-preselected-issue-type";

type Props = {
  workspaceSlug: string;
  projectId: string;
  disabled?: boolean;
};

/** The intake switch. Turning intake on asks for the type of the work items that arrive through it. */
export const IntakeEnableControl = observer(function IntakeEnableControl(props: Props) {
  const { workspaceSlug, projectId, disabled = false } = props;
  const { t } = useTranslation();
  const [typeId, setTypeId] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const { getProjectById, updateProject, enableIntake } = useProject();
  useProjectIssueTypes(workspaceSlug, projectId);
  const isOn = !!getProjectById(projectId)?.inbox_view;

  const handleChange = async (checked: boolean) => {
    if (checked && !typeId) return;
    setIsSaving(true);
    try {
      if (checked && typeId) await enableIntake(workspaceSlug, projectId, typeId);
      else await updateProject(workspaceSlug, projectId, { inbox_view: false });
      setTypeId(undefined);
    } catch {
      setToast({ type: "error", title: t("common.error.label"), message: t("common.error.message") });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!isOn && (
        <IssueTypeDropdown
          projectId={projectId}
          value={typeId}
          onChange={setTypeId}
          disabled={disabled}
          placeholder={t("project_settings.features.intake.type_placeholder")}
          variant="select-md"
          tooltip={{ heading: t("project_settings.features.intake.type_title") }}
        />
      )}
      <Switch
        size="sm"
        checked={isOn}
        onCheckedChange={(checked) => void handleChange(checked)}
        disabled={disabled || isSaving || (!isOn && !typeId)}
        aria-label={t("project_settings.features.intake.toggle_title")}
      />
    </div>
  );
});
