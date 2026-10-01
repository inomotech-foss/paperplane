/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { Checkbox } from "@makeplane/propel/components/checkbox";
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
import type { IInstanceUser, TInstanceUserError, TInstanceUserMergeResult } from "@plane/types";
// hooks
import { useInstanceUser } from "@/hooks/store";
// local
import { UserPicker } from "./user-picker";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  /** The user that gets merged away. */
  source: IInstanceUser;
};

type TRun = {
  isBusy: boolean;
  preview?: TInstanceUserMergeResult;
  error?: string;
};

export function MergeUserDialog(props: Props) {
  const { isOpen, handleClose, source } = props;
  const { previewMerge, mergeUsers } = useInstanceUser();
  // Mounted only while open, state starts fresh each time.
  const [survivor, setSurvivor] = useState<IInstanceUser | undefined>(undefined);
  const [keepSourceEmail, setKeepSourceEmail] = useState(false);
  const [run, setRun] = useState<TRun>({ isBusy: false });
  const { preview, error, isBusy } = run;

  // Any change to the inputs invalidates the dry run.
  const request = { source: source.id, keep_source_email: keepSourceEmail };

  const runPreview = async () => {
    if (!survivor) return;
    setRun({ isBusy: true });
    try {
      setRun({ isBusy: false, preview: await previewMerge(survivor.id, request) });
    } catch (caught) {
      setRun({ isBusy: false, error: (caught as TInstanceUserError)?.error ?? "The preview failed." });
    }
  };

  const runMerge = async () => {
    if (!survivor) return;
    setRun({ isBusy: true, preview });
    try {
      const result = await mergeUsers(survivor.id, request);
      setToast({
        type: "success",
        title: "Merged",
        message: `${source.email} is now part of ${result.email}.`,
      });
      handleClose();
    } catch (caught) {
      setRun({
        isBusy: false,
        error: (caught as TInstanceUserError)?.error ?? "The merge failed, nothing was changed.",
      });
    }
  };

  const relations = Object.entries(preview?.relations ?? {});

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isBusy) handleClose();
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>Merge {source.email} into another user</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <p className="text-13 text-tertiary">
                Everything this user owns, was assigned, wrote or is a member of moves to the user you pick. Where both
                already have a row, the higher role wins. This user is then deactivated and anonymised.
              </p>
              <div className="space-y-1">
                <label className="text-13 font-medium text-secondary" htmlFor="merge-survivor">
                  Merge into
                </label>
                <UserPicker
                  inputId="merge-survivor"
                  excludeIds={[source.id]}
                  selected={survivor}
                  onSelect={(user) => {
                    setSurvivor(user);
                    setRun({ isBusy: false });
                  }}
                />
                {survivor && (
                  <Button
                    variant="ghost"
                    size="sm"
                    stretch="auto"
                    onClick={() => {
                      setSurvivor(undefined);
                      setRun({ isBusy: false });
                    }}
                    label="Pick someone else"
                  />
                )}
              </div>
              <Checkbox
                label={`Keep ${source.email} as the surviving user's email`}
                checked={keepSourceEmail}
                onCheckedChange={(checked) => {
                  setKeepSourceEmail(checked === true);
                  setRun({ isBusy: false });
                }}
              />
              {preview && (
                <div className="space-y-2 rounded-md border border-subtle p-3 text-13">
                  <p>
                    Resulting email: <span className="font-medium">{preview.email}</span>
                  </p>
                  {relations.length === 0 ? (
                    <p className="text-tertiary">Nothing references this user. Only the account itself changes.</p>
                  ) : (
                    <table className="w-full text-11">
                      <thead className="text-tertiary">
                        <tr>
                          <th className="py-1 text-left font-medium">Relation</th>
                          <th className="py-1 text-right font-medium">Moves</th>
                          <th className="py-1 text-right font-medium">Dropped</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relations.map(([key, counts]) => (
                          <tr key={key}>
                            <td className="font-mono py-0.5">{key}</td>
                            <td className="py-0.5 text-right">{counts.moved}</td>
                            <td className="py-0.5 text-right">{counts.dropped}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              {error && <p className="text-danger text-11">{error}</p>}
            </div>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button variant="secondary" size="md" stretch="auto" onClick={handleClose} label="Cancel" />
          {preview ? (
            <Button variant="danger" size="md" stretch="auto" onClick={runMerge} loading={isBusy} label="Merge" />
          ) : (
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              onClick={runPreview}
              loading={isBusy}
              disabled={!survivor}
              label="Preview"
            />
          )}
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
