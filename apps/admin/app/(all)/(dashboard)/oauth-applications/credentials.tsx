/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Button } from "@plane/propel/button";
import { CopyIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IOAuthApplication } from "@plane/types";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { copyTextToClipboard } from "@plane/utils";

type Props = {
  application: IOAuthApplication;
  handleClose: () => void;
};

function CopyableField(props: { label: string; value: string }) {
  const { label, value } = props;
  const copy = () =>
    copyTextToClipboard(value).then(() =>
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Copied", message: `${label} copied to the clipboard.` })
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
        <CopyIcon className="h-4 w-4 flex-shrink-0 text-placeholder" />
      </button>
    </div>
  );
}

/** Shown once after registration. The secret is hashed on save and cannot be read back. */
export function OAuthApplicationCredentials(props: Props) {
  const { application, handleClose } = props;

  return (
    <ModalCore isOpen handleClose={() => {}} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      <div className="w-full space-y-4 p-5">
        <div className="space-y-1">
          <h3 className="text-16 font-medium text-primary">{application.name} is registered</h3>
          <p className="text-13 text-placeholder">
            Copy the secret now. It is stored hashed, so this is the only time it can be shown.
          </p>
        </div>
        <CopyableField label="Client ID" value={application.client_id} />
        <CopyableField label="Client secret" value={application.client_secret ?? ""} />
        <div className="flex justify-end pt-2">
          <Button variant="primary" size="sm" onClick={handleClose}>
            Done
          </Button>
        </div>
      </div>
    </ModalCore>
  );
}
