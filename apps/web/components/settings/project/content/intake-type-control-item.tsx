// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
// components
import { IssueTypeDropdown } from "@/components/dropdowns/issue-type";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
// hooks
import { useProjectIssueTypes } from "@/hooks/use-preselected-issue-type";
// services
import { IntakeSettingsService } from "@/services/inbox/intake-settings.service";

const intakeSettingsService = new IntakeSettingsService();

type Props = {
  workspaceSlug: string;
  projectId: string;
};

/** The type that work items arriving through the project's intake get. */
export const IntakeTypeControlItem = observer(function IntakeTypeControlItem(props: Props) {
  const { workspaceSlug, projectId } = props;
  const { t } = useTranslation();
  useProjectIssueTypes(workspaceSlug, projectId);
  const { data: intake, mutate } = useSWR(
    `PROJECT_INTAKE_${projectId}`,
    // The intake is created when the feature is turned on, so retry until it exists.
    async () => {
      const response = await intakeSettingsService.getIntake(workspaceSlug, projectId);
      if (!response.id) throw new Error("The project has no intake yet");
      return response;
    },
    { revalidateOnFocus: false }
  );

  const handleChange = async (issueTypeId: string) => {
    if (!intake) return;
    try {
      await mutate(intakeSettingsService.setIssueType(workspaceSlug, projectId, intake.id, issueTypeId), {
        optimisticData: { ...intake, issue_type: issueTypeId },
        rollbackOnError: true,
      });
    } catch {
      setToast({ type: "error", title: t("common.error.label"), message: t("common.error.message") });
    }
  };

  if (!intake?.id) return null;

  return (
    <SettingsBoxedControlItem
      title={t("project_settings.features.intake.type_title")}
      description={t("project_settings.features.intake.type_description")}
      control={
        <IssueTypeDropdown
          projectId={projectId}
          value={intake.issue_type}
          onChange={(issueTypeId) => void handleChange(issueTypeId)}
          variant="select-md"
        />
      }
    />
  );
});
