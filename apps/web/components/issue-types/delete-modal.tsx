/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import type { TIssueType } from "@plane/types";
// local imports
import { IssueTypeMigrationDialog } from "./migration-dialog";

type TDeleteIssueTypeModalProps = {
  isOpen: boolean;
  issueType: TIssueType | null;
  onClose: () => void;
};

/** Removes a type from the project, moving whatever still uses it in the same step. */
export const DeleteIssueTypeModal = observer(function DeleteIssueTypeModal(props: TDeleteIssueTypeModalProps) {
  const { isOpen, issueType, onClose } = props;
  const { workspaceSlug, projectId } = useParams();

  if (!issueType || !workspaceSlug || !projectId) return null;

  return (
    <IssueTypeMigrationDialog
      isOpen={isOpen}
      workspaceSlug={workspaceSlug.toString()}
      projectId={projectId.toString()}
      fromType={issueType}
      scope={{ project: projectId.toString() }}
      unlink
      onClose={onClose}
    />
  );
});
