/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// plane imports
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { setToast } from "@plane/blocks/toast";
import type { IWorkspace } from "@plane/types";
// hooks
import { useWorkspace } from "@/hooks/store";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  workspace: IWorkspace;
};

export function DeleteWorkspaceDialog(props: Props) {
  const { isOpen, handleClose, workspace } = props;
  const { deleteWorkspace } = useWorkspace();
  const [typed, setTyped] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await deleteWorkspace(workspace.id);
      setToast({ type: "success", title: "Deleted", message: `${workspace.name} is gone for its members.` });
      handleClose();
    } catch (caught) {
      setError((caught as { error?: string })?.error ?? "The workspace was not deleted.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      handleClose={handleClose}
      handleSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      isDisabled={typed !== workspace.slug}
      title={`Delete ${workspace.name}?`}
      content={
        <span className="block space-y-3">
          <span className="block">
            Every project, work item and page in it disappears for its members. It is kept for a while before it is
            removed for good. Type <span className="font-mono font-medium">{workspace.slug}</span> to confirm.
          </span>
          <InputGroup size="md">
            <Input
              size="md"
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={workspace.slug}
              aria-label="Workspace slug"
              autoComplete="off"
            />
          </InputGroup>
          {error && <span className="text-danger block">{error}</span>}
        </span>
      }
    />
  );
}
