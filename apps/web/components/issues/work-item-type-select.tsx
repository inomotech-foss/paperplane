// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import type { SelectTooltip, SelectVariant } from "@plane/blocks/select";
import type { TIssue } from "@plane/types";
// components
import { IssueTypeDropdown } from "@/components/dropdowns/issue-type";
import { IssueTypeMigrationDialog } from "@/components/issue-types/migration-dialog";
// hooks
import { useIssueTypes } from "@/hooks/store/use-issue-types";
// services
import { IssueTypeMigrationService } from "@/services/issue/issue-type-migration.service";

const migrationService = new IssueTypeMigrationService();

type Props = {
  workItem: Pick<TIssue, "id" | "project_id" | "type_id">;
  /** Saves a type change that loses nothing. */
  onChange: (typeId: string) => void | Promise<void>;
  variant: SelectVariant;
  disabled?: boolean;
  className?: string;
  tooltip?: SelectTooltip;
  onClose?: () => void;
};

/**
 * The type of a work item. A change that would hide custom property values of the current type opens the
 * migration dialog, which asks where those values go.
 */
export const WorkItemTypeSelect = observer(function WorkItemTypeSelect(props: Props) {
  const { workItem, onChange, variant, disabled, className, tooltip, onClose } = props;
  const { workspaceSlug } = useParams();
  const { getIssueTypeById } = useIssueTypes();
  const [pendingTypeId, setPendingTypeId] = useState<string>();
  const fromType = getIssueTypeById(workItem.type_id);
  const projectId = workItem.project_id;

  const handleChange = async (typeId: string) => {
    if (typeId === workItem.type_id || !workspaceSlug || !projectId) return;
    const preview = await migrationService.migrate(workspaceSlug.toString(), projectId, workItem.type_id, {
      scope: { work_items: [workItem.id] },
      dry_run: true,
    });
    if (preview.properties.length === 0) await onChange(typeId);
    else setPendingTypeId(typeId);
  };

  return (
    <>
      <IssueTypeDropdown
        projectId={projectId}
        value={workItem.type_id}
        onChange={(typeId) => void handleChange(typeId)}
        disabled={disabled}
        variant={variant}
        className={className}
        tooltip={tooltip}
        onClose={onClose}
      />
      {pendingTypeId && fromType && workspaceSlug && projectId && (
        <IssueTypeMigrationDialog
          isOpen
          workspaceSlug={workspaceSlug.toString()}
          projectId={projectId}
          fromType={fromType}
          scope={{ work_items: [workItem.id] }}
          replacementTypeId={pendingTypeId}
          onClose={() => setPendingTypeId(undefined)}
        />
      )}
    </>
  );
});
