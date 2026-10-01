/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// plane imports
import { ConfirmDialog } from "@plane/blocks/dialog";
import { setToast } from "@plane/blocks/toast";
import type { IInstanceUser, TInstanceUserError } from "@plane/types";
// hooks
import { useInstanceUser } from "@/hooks/store";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  user: IInstanceUser;
};

export function DeactivateUserDialog(props: Props) {
  const { isOpen, handleClose, user } = props;
  const { deactivateUser } = useInstanceUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(undefined);
    try {
      const result = await deactivateUser(user.id);
      const orphaned = [
        ...result.sole_admin_workspaces.map((slug) => `workspace ${slug}`),
        ...result.sole_admin_projects.map((project) => `project ${project.workspace}/${project.name}`),
      ];
      setToast({
        type: orphaned.length > 0 ? "warning" : "success",
        title: "Deactivated",
        message:
          orphaned.length > 0
            ? `${user.email} was the only admin of ${orphaned.join(", ")}. Give someone else that role.`
            : `${user.email} is signed out everywhere and cannot sign in again.`,
      });
      handleClose();
    } catch (caught) {
      setError((caught as TInstanceUserError)?.error ?? "The user was not deactivated.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      handleClose={() => {
        setError(undefined);
        handleClose();
      }}
      handleSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      variant="warning"
      title={`Deactivate ${user.email}?`}
      primaryButtonText={{ loading: "Deactivating", default: "Deactivate" }}
      content={
        <>
          All sessions end, the password is reset and every workspace and project membership goes inactive. This goes
          ahead even if they are an instance admin or the only admin somewhere, so you will be told where that was.
          {error && <span className="text-danger mt-2 block">{error}</span>}
        </>
      }
    />
  );
}
