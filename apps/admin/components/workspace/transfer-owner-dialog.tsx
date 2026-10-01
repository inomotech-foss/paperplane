/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { setToast } from "@plane/blocks/toast";
import type { IInstanceUser, IWorkspace } from "@plane/types";
// components
import { UserPicker } from "@/components/users/user-picker";
// hooks
import { useWorkspace } from "@/hooks/store";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  workspace: IWorkspace;
};

export function TransferOwnerDialog(props: Props) {
  const { isOpen, handleClose, workspace } = props;
  const { transferOwner } = useWorkspace();
  const [owner, setOwner] = useState<IInstanceUser | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = async () => {
    if (!owner) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      await transferOwner(workspace.id, owner.id);
      setToast({ type: "success", title: "Owner changed", message: `${owner.email} now owns ${workspace.name}.` });
      handleClose();
    } catch (caught) {
      setError((caught as { error?: string })?.error ?? "The owner was not changed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) handleClose();
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>Transfer {workspace.name} to a new owner</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <p className="text-13 text-tertiary">
                Currently owned by {workspace.owner?.email ?? "nobody"}. The new owner becomes an active admin of the
                workspace. The previous owner keeps their membership.
              </p>
              <div className="space-y-1">
                <label className="text-13 font-medium text-secondary" htmlFor="transfer-owner">
                  New owner
                </label>
                <UserPicker
                  inputId="transfer-owner"
                  excludeIds={workspace.owner?.id ? [workspace.owner.id] : []}
                  selected={owner}
                  onSelect={setOwner}
                />
                {owner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    stretch="auto"
                    onClick={() => setOwner(undefined)}
                    label="Pick someone else"
                  />
                )}
              </div>
              {error && <p className="text-danger text-11">{error}</p>}
            </div>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button variant="secondary" size="md" stretch="auto" onClick={handleClose} label="Cancel" />
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!owner}
            label="Transfer"
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
