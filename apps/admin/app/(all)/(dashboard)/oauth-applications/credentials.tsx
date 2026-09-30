/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { CopyOutline } from "@makeplane/propel/icons";
import { setToast } from "@plane/blocks/toast";
import type { IOAuthApplication } from "@plane/types";
import { copyTextToClipboard } from "@plane/utils";

type Props = {
  application: IOAuthApplication;
  handleClose: () => void;
};

function CopyableField(props: { label: string; value: string }) {
  const { label, value } = props;
  const copy = () =>
    copyTextToClipboard(value).then(() =>
      setToast({ type: "success", title: "Copied", message: `${label} copied to the clipboard.` })
    );

  return (
    <div className="space-y-1">
      <p className="text-13 font-medium text-secondary">{label}</p>
      <button
        type="button"
        onClick={copy}
        className="flex w-full items-center justify-between truncate rounded-md border-[0.5px] border-subtle px-3 py-2 text-13 font-medium outline-none"
      >
        <span className="truncate pr-2">{value}</span>
        <CopyOutline className="h-4 w-4 flex-shrink-0 text-placeholder" />
      </button>
    </div>
  );
}

/** Shown once after registration. The secret is hashed on save and cannot be read back. */
export function OAuthApplicationCredentials(props: Props) {
  const { application, handleClose } = props;

  return (
    // Not dismissable: the secret is shown only once, so closing takes the explicit "Done".
    <Dialog open disablePointerDismissal onOpenChange={() => {}}>
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{application.name} is registered</DialogTitle>
              <DialogDescription>
                Copy the secret now. It is stored hashed, so this is the only time it can be shown.
              </DialogDescription>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <CopyableField label="Client ID" value={application.client_id} />
              <CopyableField label="Client secret" value={application.client_secret ?? ""} />
            </div>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button variant="primary" size="md" stretch="auto" onClick={handleClose} label="Done" />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
