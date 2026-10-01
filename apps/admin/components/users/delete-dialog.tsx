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

export function DeleteUserDialog(props: Props) {
  const { isOpen, handleClose, user } = props;
  const { deleteUser } = useInstanceUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refusal, setRefusal] = useState<TInstanceUserError | undefined>(undefined);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setRefusal(undefined);
    try {
      await deleteUser(user.id);
      setToast({ type: "success", title: "Deleted", message: `${user.email} was anonymised and deactivated.` });
      handleClose();
    } catch (caught) {
      setRefusal((caught as TInstanceUserError) ?? { error: "The user was not deleted." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      handleClose={() => {
        setRefusal(undefined);
        handleClose();
      }}
      handleSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      isDisabled={Boolean(refusal?.owned_workspaces?.length)}
      title={`Delete ${user.email}?`}
      content={
        <>
          The account is deactivated and its email, name and avatar are wiped. Linked sign-in providers, API tokens and
          sessions are revoked. Work items, comments and activity stay and show a deleted user.
          {refusal && (
            <span className="text-danger mt-2 block">
              {refusal.error}
              {refusal.owned_workspaces && refusal.owned_workspaces.length > 0 && (
                <>
                  {" "}
                  Owned: {refusal.owned_workspaces.join(", ")}. Use &quot;Transfer owner&quot; on the Workspaces page
                  first.
                </>
              )}
            </span>
          )}
        </>
      }
    />
  );
}
