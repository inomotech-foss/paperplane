// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { observer } from "mobx-react";
import type { Control } from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";
import useSWR from "swr";
// plane imports
import { Switch } from "@makeplane/propel/components/switch";
import type { TProjectPublishSettings } from "@plane/types";
// components
import { IssueTypeDropdown } from "@/components/dropdowns/issue-type";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectIssueTypes } from "@/hooks/use-preselected-issue-type";
// services
import { ProjectIntakeService } from "@/services/inbox/project-intake.service";

const projectIntakeService = new ProjectIntakeService();

type TPublishForm = Partial<TProjectPublishSettings>;

/** The intake fields of a publish request. A board without intake submissions has no type. */
export const toIntakeSettings = (form: TPublishForm): Pick<TPublishForm, "intake" | "intake_issue_type"> => ({
  intake: form.intake ?? null,
  intake_issue_type: form.intake ? (form.intake_issue_type ?? null) : null,
});

/** Whether the board takes intake submissions but their type is still missing. */
export const useNeedsIntakeType = (control: Control<TPublishForm>) => {
  const [intake, issueType] = useWatch({ control, name: ["intake", "intake_issue_type"] });
  return !!intake && !issueType;
};

/** The project's intake once it is on, so the published board can take submissions. */
const useProjectIntakeId = (workspaceSlug: string | undefined, projectId: string, isOpen: boolean) => {
  const isIntakeOn = !!useProject().getProjectById(projectId)?.inbox_view;
  useProjectIssueTypes(workspaceSlug, isIntakeOn ? projectId : undefined);
  const { data } = useSWR(
    workspaceSlug && isOpen && isIntakeOn ? `PROJECT_INTAKE_${projectId}` : null,
    workspaceSlug ? () => projectIntakeService.getIntake(workspaceSlug, projectId) : null,
    { revalidateOnFocus: false }
  );
  return data?.id;
};

type Props = {
  control: Control<TPublishForm>;
  workspaceSlug: string | undefined;
  projectId: string;
  isOpen: boolean;
};

/** Lets the published board take intake submissions, each with the chosen type. */
export const PublishIntakeSettings = observer(function PublishIntakeSettings(props: Props) {
  const { control, workspaceSlug, projectId, isOpen } = props;
  const intakeId = useProjectIntakeId(workspaceSlug, projectId, isOpen);
  const intake = useWatch({ control, name: "intake" });

  if (!intakeId && !intake) return null;

  return (
    <>
      <div className="relative flex items-center justify-between gap-2">
        <div className="text-13">Take intake submissions</div>
        <Controller
          control={control}
          name="intake"
          render={({ field: { onChange, value } }) => (
            <Switch
              size="sm"
              checked={!!value}
              onCheckedChange={(checked) => onChange(checked ? intakeId : null)}
              disabled={!value && !intakeId}
              aria-label="Take intake submissions"
            />
          )}
        />
      </div>
      {intake && (
        <div className="relative flex items-center justify-between gap-2">
          <div className="text-13">Type of submitted work items</div>
          <Controller
            control={control}
            name="intake_issue_type"
            render={({ field: { onChange, value } }) => (
              <span className="flex shrink-0">
                <IssueTypeDropdown
                  projectId={projectId}
                  value={value}
                  onChange={onChange}
                  placeholder="Choose a type"
                  variant="select-ghost-md"
                />
              </span>
            )}
          />
        </div>
      )}
    </>
  );
});
