// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import useSWR from "swr";
// plane imports
import { Select } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import { unwrap } from "@plane/services";
import type { ApiSchema } from "@plane/api-types";
// services
import { apiClient } from "@/services/api-client";

type TIssueTypeOption = ApiSchema<"IssueType">;

type Props = {
  workspaceSlug: string;
  /** The type of the work items that arrive through the intake, or undefined to start without intake. */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  tabIndex?: number;
};

const OFF = "__off__";

/** Starts the new project with intake on: choosing the type of its work items turns it on. */
export function IntakeTypeSelect(props: Props) {
  const { workspaceSlug, value, onChange, tabIndex } = props;
  const { t } = useTranslation();
  const { data: issueTypes } = useSWR(
    `WORKSPACE_ISSUE_TYPES_${workspaceSlug}`,
    () => unwrap(apiClient.GET("/api/workspaces/{slug}/issue-types/", { params: { path: { slug: workspaceSlug } } })),
    { revalidateOnFocus: false }
  );
  const choices = (issueTypes ?? []).filter((type) => !type.is_epic && type.is_active);
  const selected = choices.find((type) => type.id === value) ?? null;
  const offLabel = t("project_settings.features.intake.create_off");

  return (
    <Select<TIssueTypeOption | null>
      getValues={() => [null, ...choices]}
      value={selected}
      onChange={(id) => onChange(id === OFF ? undefined : id)}
      getOptionValue={(type) => type?.id ?? OFF}
      getOptionLabel={(type) => type?.name ?? offLabel}
      showSearch={false}
      pinSelected={false}
    >
      <Select.Trigger<TIssueTypeOption | null> variant="pill-md" tabIndex={tabIndex}>
        {() => (
          <span className="truncate">
            {selected ? t("project_settings.features.intake.create_with_type", { name: selected.name }) : offLabel}
          </span>
        )}
      </Select.Trigger>
    </Select>
  );
}
